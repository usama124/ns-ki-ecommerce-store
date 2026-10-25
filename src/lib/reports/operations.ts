import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import type { Document } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { RequestError, validDocumentID } from '@/utilities/apiSecurity'
import { COMMERCE, mongoCommerce, type InternalRecord } from '@/utilities/commerceDatabase'
import { OPERATIONS, requireOperationsAdmin } from '@/utilities/operationsHistory'
import { parseReportFilters, reportPeriod } from './filters'
import { csvCell } from './csv'

export async function operationsStatus(payload: Payload, user: User) {
  requireOperationsAdmin(user)
  const { db, adapter } = mongoCommerce(payload)
  const config = await db
    .collection<InternalRecord>(COMMERCE.config)
    .findOne({ _id: 'operations-v1', ready: true })
  if (!config)
    return {
      ready: false,
      coverageStartedAt: null,
      currentVariants: 0,
      trackedVariants: 0,
      driftedVariants: 0,
    }
  const counts = await db
    .collection(adapter.collections.products.collection.collectionName)
    .aggregate<Document>(
      [
        { $unwind: '$variants' },
        {
          $set: {
            balanceKey: {
              $concat: [
                { $toString: '$_id' },
                ':',
                { $toString: { $ifNull: ['$variants.id', '$variants._id'] } },
              ],
            },
          },
        },
        {
          $lookup: {
            from: OPERATIONS.balances,
            localField: 'balanceKey',
            foreignField: '_id',
            as: 'balance',
          },
        },
        { $set: { tracked: { $eq: [{ $first: '$balance.active' }, true] } } },
        {
          $group: {
            _id: null,
            currentVariants: { $sum: 1 },
            trackedVariants: { $sum: { $cond: ['$tracked', 1, 0] } },
            driftedVariants: {
              $sum: {
                $cond: [
                  {
                    $and: ['$tracked', { $ne: ['$variants.stock', { $first: '$balance.stock' }] }],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ],
      { maxTimeMS: 10000 },
    )
    .toArray()
  return {
    ready: true,
    coverageStartedAt: config.coverageStartedAt,
    currentVariants: counts[0]?.currentVariants || 0,
    trackedVariants: counts[0]?.trackedVariants || 0,
    driftedVariants: counts[0]?.driftedVariants || 0,
  }
}

export function operationFilters(search: URLSearchParams) {
  const allowed = ['source', 'start', 'end', 'page', 'orderId', 'productId', 'milestone', 'format']
  for (const key of search.keys())
    if (!allowed.includes(key) || search.getAll(key).length !== 1)
      throw new RequestError('Invalid history filter.')
  const source = search.get('source') || 'orders'
  if (!['orders', 'stock', 'milestones'].includes(source))
    throw new RequestError('Invalid history source.')
  const dates = new URLSearchParams()
  for (const key of ['start', 'end', 'page']) if (search.has(key)) dates.set(key, search.get(key)!)
  const parsed = parseReportFilters(dates)
  const orderId = search.get('orderId') || '',
    productId = search.get('productId') || ''
  if ((orderId && !validDocumentID(orderId)) || (productId && !validDocumentID(productId)))
    throw new RequestError('Invalid history record ID.')
  if ((source === 'stock' && orderId) || (source !== 'stock' && productId))
    throw new RequestError('Use the matching record ID filter for this source.')
  const milestone = search.get('milestone') || 'firstConfirmedAt'
  if (
    !['firstConfirmedAt', 'firstShippedAt', 'firstDeliveredAt'].includes(milestone) ||
    (search.has('milestone') && source !== 'milestones')
  )
    throw new RequestError('Invalid milestone filter.')
  const format = search.get('format') || 'json'
  if (!['json', 'csv'].includes(format)) throw new RequestError('Invalid export format.')
  return {
    source,
    start: parsed.start,
    end: parsed.end,
    page: parsed.page,
    orderId,
    productId,
    ...(source === 'milestones' ? { milestone } : {}),
    format,
  }
}

export async function operationsReport(payload: Payload, user: User, search: URLSearchParams) {
  requireOperationsAdmin(user)
  const filters = operationFilters(search),
    { db } = mongoCommerce(payload)
  const ready = await db
    .collection<InternalRecord>(COMMERCE.config)
    .findOne({ _id: 'operations-v1', ready: true })
  if (!ready) throw new RequestError('Initialize operations tracking first.', 503)
  const period = reportPeriod(filters)
  const dateField = filters.source === 'milestones' ? filters.milestone! : 'recordedAt'
  const match: Document = { [dateField]: { $gte: period.start, $lt: period.end } }
  if (filters.orderId) match[filters.source === 'milestones' ? '_id' : 'orderId'] = filters.orderId
  if (filters.productId) match.productId = filters.productId
  const projection: Document =
    filters.source === 'stock'
      ? {
          productId: 1,
          variantId: 1,
          title: 1,
          sku: 1,
          orderId: { $ifNull: ['$orderId', ''] },
          kind: 1,
          before: 1,
          after: 1,
          delta: 1,
          actorId: 1,
        }
      : filters.source === 'milestones'
        ? {
            orderId: '$_id',
            orderNumber: 1,
            currentStatus: 1,
            coverage: 1,
            deleted: 1,
            value:
              filters.milestone === 'firstConfirmedAt'
                ? { $ifNull: ['$firstConfirmedValue', null] }
                : { $literal: null },
          }
        : {
            orderId: 1,
            orderNumber: 1,
            kind: 1,
            fromStatus: 1,
            toStatus: 1,
            actorId: 1,
            total: 1,
            requestedUnits: 1,
            deductedUnits: 1,
            backorderedUnits: 1,
            ...(filters.orderId && filters.format !== 'csv' ? { items: 1 } : {}),
          }
  const exporting = filters.format === 'csv'
  const result = (
    await db
      .collection(
        filters.source === 'stock'
          ? OPERATIONS.stock
          : filters.source === 'orders'
            ? OPERATIONS.history
            : OPERATIONS.milestones,
      )
      .aggregate<Document>(
        [
          { $match: match },
          {
            $facet: {
              total: [{ $count: 'value' }],
              rows: [
                { $sort: { [dateField]: -1, _id: -1 } },
                ...(exporting ? [] : [{ $skip: (filters.page - 1) * 50 }]),
                { $limit: exporting ? 5001 : 50 },
                {
                  $project: {
                    _id: 0,
                    id: '$_id',
                    recordedAt: {
                      $dateToString: { date: `$${dateField}`, format: '%Y-%m-%dT%H:%M:%S.%LZ' },
                    },
                    ...projection,
                  },
                },
              ],
              summary: [
                {
                  $group: {
                    _id: null,
                    records: { $sum: 1 },
                    netStockChange: { $sum: '$delta' },
                    openingRows: { $sum: { $cond: [{ $eq: ['$kind', 'opening_balance'] }, 1, 0] } },
                    confirmedValue: {
                      $sum:
                        filters.source === 'milestones' && filters.milestone === 'firstConfirmedAt'
                          ? '$firstConfirmedValue'
                          : 0,
                    },
                  },
                },
              ],
            },
          },
        ],
        { maxTimeMS: 10000, allowDiskUse: true },
      )
      .toArray()
  )[0]
  const total = result?.total[0]?.value || 0
  if (exporting && total > 5000)
    throw new RequestError('History export exceeds 5000 rows. Narrow the filters.', 413)
  return {
    filters,
    coverageStartedAt: ready.coverageStartedAt,
    generatedAt: new Date().toISOString(),
    dateBasis:
      filters.source === 'milestones'
        ? `Recorded ${filters.milestone} · Asia/Karachi · orders tracked since creation only`
        : 'Event recorded-at · Asia/Karachi; not order placement date',
    rows: result?.rows || [],
    summary: result?.summary[0]
      ? {
          records: result.summary[0].records,
          netStockChange: result.summary[0].netStockChange,
          openingRows: result.summary[0].openingRows,
          confirmedValue: result.summary[0].confirmedValue,
        }
      : { records: 0, netStockChange: 0, openingRows: 0, confirmedValue: 0 },
    pagination: {
      page: filters.page,
      totalRows: total,
      totalPages: Math.max(1, Math.ceil(total / 50)),
    },
  }
}

export async function operationsCSV(
  payload: Payload,
  user: User,
  report: Awaited<ReturnType<typeof operationsReport>>,
) {
  requireOperationsAdmin(user)
  const columns =
    report.filters.source === 'stock'
      ? [
          'recordedAt',
          'productId',
          'variantId',
          'title',
          'sku',
          'kind',
          'before',
          'after',
          'delta',
          'orderId',
          'actorId',
        ]
      : report.filters.source === 'milestones'
        ? ['recordedAt', 'orderId', 'orderNumber', 'currentStatus', 'coverage', 'value', 'deleted']
        : [
            'recordedAt',
            'orderId',
            'orderNumber',
            'kind',
            'fromStatus',
            'toStatus',
            'total',
            'requestedUnits',
            'deductedUnits',
            'backorderedUnits',
            'actorId',
          ]
  await mongoCommerce(payload)
    .db.collection<InternalRecord>(OPERATIONS.audit)
    .insertOne({
      _id: randomUUID(),
      actorId: String(user.id),
      filters: report.filters,
      rows: report.rows.length,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 86400000),
    })
  return (
    '\uFEFF' +
    [
      columns.map(csvCell).join(','),
      ...report.rows.map((row: Document) => columns.map((key) => csvCell(row[key])).join(',')),
    ].join('\r\n') +
    '\r\n'
  )
}
