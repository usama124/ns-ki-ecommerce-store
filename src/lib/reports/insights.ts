import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import type { Document } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { RequestError, validDocumentID } from '@/utilities/apiSecurity'
import {
  COMMERCE,
  mongoCommerce,
  requireCommerceReady,
  type InternalRecord,
} from '@/utilities/commerceDatabase'
import { OPERATIONS, requireOperationsAdmin } from '@/utilities/operationsHistory'
import { MONEY } from '@/utilities/paymentLedger'
import { parseReportFilters, reportPeriod } from './filters'
import { karachiDate, offsetDay } from './model'
import { csvCell } from './csv'

const auditCollection = 'nski_insight_exports'
export async function initializeInsights(payload: Payload, user: User) {
  requireOperationsAdmin(user)
  const { db } = await requireCommerceReady(payload)
  await db
    .collection(OPERATIONS.stock)
    .createIndex({ productId: 1, variantId: 1, recordedAt: -1, sequence: -1 })
  for (const field of ['firstConfirmedAt', 'firstShippedAt', 'firstDeliveredAt'])
    await db.collection(OPERATIONS.milestones).createIndex({ [field]: 1 })
  await db.collection(MONEY.entries).createIndex({ occurredAt: 1, _id: 1 })
  await db.collection(auditCollection).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db
    .collection<InternalRecord>(COMMERCE.config)
    .updateOne({ _id: 'insights-v1' }, { $set: { ready: true } }, { upsert: true })
}
export async function insightStatus(payload: Payload, user: User) {
  requireOperationsAdmin(user)
  const { db } = mongoCommerce(payload)
  const configs = await db
    .collection<InternalRecord>(COMMERCE.config)
    .find({ _id: { $in: ['insights-v1', 'operations-v1', 'money-v1'] }, ready: true })
    .toArray()
  const get = (id: string) => configs.find((config) => config._id === id)
  return {
    ready: Boolean(get('insights-v1')),
    historyReady: Boolean(get('operations-v1')),
    moneyReady: Boolean(get('money-v1')),
    historyStartedAt: get('operations-v1')?.coverageStartedAt || null,
    moneyStartedAt: get('money-v1')?.coverageStartedAt || null,
  }
}
export function insightFilters(search: URLSearchParams, now = new Date()) {
  for (const key of search.keys())
    if (
      !['view', 'start', 'end', 'page', 'productId', 'format'].includes(key) ||
      search.getAll(key).length !== 1
    )
      throw new RequestError('Invalid insight filter.')
  const view = search.get('view') || 'trends',
    productId = search.get('productId') || ''
  if (
    !['trends', 'stock'].includes(view) ||
    (productId && (!validDocumentID(productId) || view !== 'stock'))
  )
    throw new RequestError('Invalid insight view/product ID.')
  const dateParams = new URLSearchParams()
  for (const key of ['start', 'end', 'page', 'format'])
    if (search.has(key)) dateParams.set(key, search.get(key)!)
  const parsed = parseReportFilters(dateParams, now)
  if (parsed.end > karachiDate(now))
    throw new RequestError('Historical insights cannot include future dates.')
  return {
    view,
    start: parsed.start,
    end: parsed.end,
    page: parsed.page,
    productId,
    format: search.get('format') || 'json',
  }
}
export type InsightFilters = ReturnType<typeof insightFilters>

async function dailyTrends(
  payload: Payload,
  filters: InsightFilters,
  status: Awaited<ReturnType<typeof insightStatus>>,
  now: Date,
) {
  const { db } = mongoCommerce(payload),
    period = reportPeriod(filters)
  const rows: Document[] = []
  const series = await Promise.all(
    ['firstConfirmedAt', 'firstShippedAt', 'firstDeliveredAt'].map(async (field) => {
      if (!status.historyReady) return []
      return db
        .collection(OPERATIONS.milestones)
        .aggregate<Document>(
          [
            {
              $match: {
                coverage: 'since_creation',
                [field]: { $gte: period.start, $lt: period.end, $lte: now },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    date: `$${field}`,
                    format: '%Y-%m-%d',
                    timezone: 'Asia/Karachi',
                  },
                },
                count: { $sum: 1 },
                value: { $sum: field === 'firstConfirmedAt' ? '$firstConfirmedValue' : 0 },
              },
            },
          ],
          { maxTimeMS: 10000 },
        )
        .toArray()
    }),
  )
  const money = status.moneyReady
    ? await db
        .collection(MONEY.entries)
        .aggregate<Document>(
          [
            { $match: { occurredAt: { $gte: period.start, $lt: period.end, $lte: now } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    date: '$occurredAt',
                    format: '%Y-%m-%d',
                    timezone: 'Asia/Karachi',
                  },
                },
                collectedMinor: {
                  $sum: { $cond: [{ $eq: ['$kind', 'collection'] }, '$amountMinor', 0] },
                },
                refundedMinor: {
                  $sum: { $cond: [{ $eq: ['$kind', 'refund'] }, '$amountMinor', 0] },
                },
              },
            },
          ],
          { maxTimeMS: 10000 },
        )
        .toArray()
    : []
  for (let day = filters.start; day <= filters.end; day = offsetDay(day, 1)) {
    const dayStart = new Date(`${day}T00:00:00+05:00`),
      dayEnd = new Date(`${offsetDay(day, 1)}T00:00:00+05:00`)
    const before =
      !status.historyReady ||
      !status.historyStartedAt ||
      dayEnd <= new Date(status.historyStartedAt)
    const values = series.map((series) => series.find((row) => row._id === day)),
      paid = money.find((row) => row._id === day)
    rows.push({
      day,
      historyCoverage: !status.historyReady
        ? 'not_enabled'
        : before
          ? 'before_tracking'
          : dayStart < new Date(status.historyStartedAt!)
            ? 'activation_day_partial'
            : dayEnd > now
              ? 'current_day_partial'
              : 'tracked_new_orders_only',
      firstConfirmed: before ? null : values[0]?.count || 0,
      firstConfirmedValuePKR: before ? null : values[0]?.value || 0,
      firstShipped: before ? null : values[1]?.count || 0,
      firstDelivered: before ? null : values[2]?.count || 0,
      collectedPKR: status.moneyReady ? (paid?.collectedMinor || 0) / 100 : null,
      refundedPKR: status.moneyReady ? (paid?.refundedMinor || 0) / 100 : null,
      netRecordedPKR: status.moneyReady
        ? ((paid?.collectedMinor || 0) - (paid?.refundedMinor || 0)) / 100
        : null,
    })
  }
  const sum = (field: string) =>
    rows.some((row) => row[field] !== null)
      ? rows.reduce((total, row) => total + (row[field] || 0), 0)
      : null
  return {
    rows: filters.format === 'csv' ? rows : rows.slice((filters.page - 1) * 50, filters.page * 50),
    total: rows.length,
    summary: {
      ...Object.fromEntries(
        ['firstConfirmed', 'firstConfirmedValuePKR', 'firstShipped', 'firstDelivered'].map(
          (field) => [field, sum(field)],
        ),
      ),
      collectedPKR: status.moneyReady
        ? money.reduce((total, row) => total + row.collectedMinor, 0) / 100
        : null,
      refundedPKR: status.moneyReady
        ? money.reduce((total, row) => total + row.refundedMinor, 0) / 100
        : null,
      netRecordedPKR: status.moneyReady
        ? money.reduce((total, row) => total + row.collectedMinor - row.refundedMinor, 0) / 100
        : null,
    },
  }
}

async function stockInsights(payload: Payload, filters: InsightFilters, now: Date) {
  const { db, adapter } = mongoCommerce(payload),
    period = reportPeriod(filters)
  const cutoff = new Date(Math.min(now.getTime(), period.end.getTime())),
    elapsedDays = (cutoff.getTime() - period.start.getTime()) / 86400000
  const lastBalance = (name: string, before: Date) => ({
    $lookup: {
      from: OPERATIONS.stock,
      let: { p: '$productId', v: '$variantId' },
      pipeline: [
        {
          $match: {
            $expr: { $and: [{ $eq: ['$productId', '$$p'] }, { $eq: ['$variantId', '$$v'] }] },
            ...(name === 'opening'
              ? {
                  $or: [
                    { recordedAt: { $lt: before } },
                    { recordedAt: before, kind: 'opening_balance' },
                  ],
                }
              : { recordedAt: { $lt: before } }),
          },
        },
        { $sort: { recordedAt: -1, sequence: -1 } },
        { $limit: 1 },
        { $project: { after: 1 } },
      ],
      as: name,
    },
  })
  let productMatch: Document = {}
  if (filters.productId) {
    try {
      productMatch = {
        _id: adapter.collections.products.schema.path('_id').cast(filters.productId),
      }
    } catch {
      throw new RequestError('Invalid product ID.')
    }
  }
  const result = await db
    .collection(adapter.collections.products.collection.collectionName)
    .aggregate<Document>(
      [
        { $match: productMatch },
        { $unwind: '$variants' },
        {
          $project: {
            _id: 0,
            productId: { $toString: '$_id' },
            variantId: { $toString: { $ifNull: ['$variants.id', '$variants._id'] } },
            title: 1,
            sku: '$variants.sku',
            stock: '$variants.stock',
          },
        },
        { $set: { key: { $concat: ['$productId', ':', '$variantId'] } } },
        {
          $lookup: {
            from: OPERATIONS.balances,
            localField: 'key',
            foreignField: '_id',
            as: 'balanceRows',
          },
        },
        { $set: { balance: { $first: '$balanceRows' } } },
        {
          $set: {
            tracked: { $eq: ['$balance.active', true] },
            consistent: {
              $and: [
                { $eq: ['$balance.active', true] },
                { $eq: [{ $type: '$balance.baselineAt' }, 'date'] },
                { $isNumber: '$stock' },
                { $gte: ['$stock', 0] },
                { $eq: ['$stock', '$balance.stock'] },
              ],
            },
            baselineAt: { $ifNull: ['$balance.baselineAt', null] },
            lastObservedChangeAt: { $ifNull: ['$balance.lastChangedAt', '$balance.baselineAt'] },
          },
        },
        lastBalance('opening', period.start),
        lastBalance('closing', cutoff),
        {
          $lookup: {
            from: OPERATIONS.stock,
            let: { p: '$productId', v: '$variantId' },
            pipeline: [
              {
                $match: {
                  $expr: { $and: [{ $eq: ['$productId', '$$p'] }, { $eq: ['$variantId', '$$v'] }] },
                  recordedAt: { $gte: period.start, $lt: cutoff },
                  kind: { $ne: 'opening_balance' },
                },
              },
              {
                $group: {
                  _id: null,
                  netChange: { $sum: '$delta' },
                  allocated: {
                    $sum: {
                      $cond: [
                        { $eq: ['$kind', 'order_allocation'] },
                        { $max: [0, { $multiply: ['$delta', -1] }] },
                        0,
                      ],
                    },
                  },
                  restored: {
                    $sum: {
                      $cond: [{ $eq: ['$kind', 'order_restore'] }, { $max: [0, '$delta'] }, 0],
                    },
                  },
                },
              },
            ],
            as: 'movementRows',
          },
        },
        {
          $set: {
            movement: { $first: '$movementRows' },
            fullWindow: { $and: ['$consistent', { $lte: ['$baselineAt', period.start] }] },
          },
        },
        {
          $project: {
            _id: 0,
            productId: 1,
            variantId: 1,
            title: 1,
            sku: { $ifNull: ['$sku', ''] },
            stock: { $ifNull: ['$stock', null] },
            coverage: {
              $cond: [
                '$consistent',
                { $cond: ['$fullWindow', 'full_window', 'partial_window'] },
                { $cond: ['$tracked', 'drifted', 'untracked'] },
              ],
            },
            baselineAt: 1,
            lastObservedChangeAt: { $cond: ['$consistent', '$lastObservedChangeAt', null] },
            daysWithoutRecordedChange: {
              $cond: [
                '$consistent',
                {
                  $max: [
                    0,
                    {
                      $floor: {
                        $divide: [{ $subtract: [now, '$lastObservedChangeAt'] }, 86400000],
                      },
                    },
                  ],
                },
                null,
              ],
            },
            openingStock: {
              $cond: ['$fullWindow', { $ifNull: [{ $first: '$opening.after' }, null] }, null],
            },
            closingStock: {
              $cond: [
                { $and: ['$consistent', { $lt: ['$baselineAt', cutoff] }] },
                { $ifNull: [{ $first: '$closing.after' }, null] },
                null,
              ],
            },
            recordedNetChange: {
              $cond: ['$tracked', { $ifNull: ['$movement.netChange', 0] }, null],
            },
            allocatedUnits: { $cond: ['$tracked', { $ifNull: ['$movement.allocated', 0] }, null] },
            restoredUnits: { $cond: ['$tracked', { $ifNull: ['$movement.restored', 0] }, null] },
            allocationCoverageDays: {
              $cond: [
                {
                  $and: [
                    '$fullWindow',
                    { $gt: ['$movement.allocated', 0] },
                    { $gt: [elapsedDays, 0] },
                  ],
                },
                { $divide: [{ $multiply: ['$stock', elapsedDays] }, '$movement.allocated'] },
                null,
              ],
            },
          },
        },
        {
          $facet: {
            rows: [
              { $sort: { productId: 1, variantId: 1 } },
              { $skip: filters.format === 'csv' ? 0 : (filters.page - 1) * 50 },
              { $limit: filters.format === 'csv' ? 5001 : 50 },
            ],
            summary: [
              {
                $group: {
                  _id: null,
                  variants: { $sum: 1 },
                  untracked: { $sum: { $cond: [{ $eq: ['$coverage', 'untracked'] }, 1, 0] } },
                  drifted: { $sum: { $cond: [{ $eq: ['$coverage', 'drifted'] }, 1, 0] } },
                  fullWindow: { $sum: { $cond: [{ $eq: ['$coverage', 'full_window'] }, 1, 0] } },
                  inactive30Plus: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $gt: ['$stock', 0] },
                            { $gte: ['$daysWithoutRecordedChange', 30] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  recordedAllocatedUnits: { $sum: '$allocatedUnits' },
                  recordedRestoredUnits: { $sum: '$restoredUnits' },
                },
              },
            ],
          },
        },
      ],
      { maxTimeMS: 10000, allowDiskUse: true, readConcern: { level: 'snapshot' } },
    )
    .toArray()
  const summary = result[0]?.summary[0] || {
    variants: 0,
    untracked: 0,
    drifted: 0,
    fullWindow: 0,
    inactive30Plus: 0,
    recordedAllocatedUnits: 0,
    recordedRestoredUnits: 0,
  }
  if (filters.format === 'csv' && summary.variants > 5000)
    throw new RequestError(
      'Narrow the product filter; stock insights export exceeds 5,000 variants.',
      413,
    )
  delete summary._id
  return { rows: result[0]?.rows || [], total: summary.variants, summary }
}

export async function insightReport(
  payload: Payload,
  user: User,
  search: URLSearchParams,
  now = new Date(),
) {
  requireOperationsAdmin(user)
  const filters = insightFilters(search, now),
    status = await insightStatus(payload, user)
  if (!status.ready) throw new RequestError('Prepare insight indexes and exports first.', 503)
  if (filters.view === 'stock' && !status.historyReady)
    throw new RequestError(
      'Stock insights require explicitly enabled history and inventory baselines.',
      503,
    )
  const result =
    filters.view === 'trends'
      ? await dailyTrends(payload, filters, status, now)
      : await stockInsights(payload, filters, now)
  return {
    filters,
    status,
    generatedAt: now.toISOString(),
    rows: result.rows as Document[],
    summary: result.summary,
    pagination: {
      page: filters.page,
      totalRows: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / 50)),
    },
    definition:
      filters.view === 'trends'
        ? 'First milestones for orders tracked since creation; money by actual occurrence date. Karachi days, current day partial. Independent event series, not a conversion cohort. Zero money means no recorded events, not proof of no payment.'
        : 'Current catalog variants only. Historical opening/closing use recorded ledger balances; current stock and inactivity are as of request. Allocation coverage is current stock / gross recorded physical allocations per elapsed day, not sales, demand or a forecast. Partial/drifted/untracked windows and zero allocations have no estimate. No lot/receipt data: physical unit aging is unavailable.',
  }
}
export async function insightCSV(
  payload: Payload,
  user: User,
  report: Awaited<ReturnType<typeof insightReport>>,
) {
  requireOperationsAdmin(user)
  if (
    report.filters.format !== 'csv' ||
    report.rows.length !== report.pagination.totalRows ||
    report.rows.length > 5000
  )
    throw new RequestError('A complete bounded insight export is required.')
  const columns =
    report.filters.view === 'trends'
      ? [
          'day',
          'historyCoverage',
          'firstConfirmed',
          'firstConfirmedValuePKR',
          'firstShipped',
          'firstDelivered',
          'collectedPKR',
          'refundedPKR',
          'netRecordedPKR',
        ]
      : [
          'productId',
          'variantId',
          'title',
          'sku',
          'stock',
          'coverage',
          'baselineAt',
          'lastObservedChangeAt',
          'daysWithoutRecordedChange',
          'openingStock',
          'closingStock',
          'recordedNetChange',
          'allocatedUnits',
          'restoredUnits',
          'allocationCoverageDays',
        ]
  await mongoCommerce(payload)
    .db.collection<InternalRecord>(auditCollection)
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
      ...report.rows.map((row) =>
        columns
          .map((key) => csvCell(row[key] instanceof Date ? row[key].toISOString() : row[key]))
          .join(','),
      ),
    ].join('\r\n') +
    '\r\n'
  )
}
