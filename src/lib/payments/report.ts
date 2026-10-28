import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import type { Document } from 'mongodb'
import { randomUUID } from 'node:crypto'
import type { InternalRecord } from '@/utilities/commerceDatabase'
import { RequestError, validDocumentID } from '@/utilities/apiSecurity'
import { MONEY, requireMoneyReady } from '@/utilities/paymentLedger'
import { requireOperationsAdmin } from '@/utilities/operationsHistory'
import { parseReportFilters, reportPeriod } from '@/lib/reports/filters'
import { csvCell } from '@/lib/reports/csv'

export function moneyFilters(search: URLSearchParams) {
  for (const key of search.keys())
    if (
      !['start', 'end', 'page', 'orderId', 'format'].includes(key) ||
      search.getAll(key).length !== 1
    )
      throw new RequestError('Invalid money report filter.')
  const dates = new URLSearchParams()
  for (const key of ['start', 'end', 'page', 'format'])
    if (search.has(key)) dates.set(key, search.get(key)!)
  const parsed = parseReportFilters(dates)
  const orderId = search.get('orderId') || ''
  if (orderId && !validDocumentID(orderId)) throw new RequestError('Invalid order ID.')
  return {
    start: parsed.start,
    end: parsed.end,
    page: parsed.page,
    orderId,
    format: search.get('format') || 'json',
  }
}
export async function moneyReport(payload: Payload, user: User, search: URLSearchParams) {
  requireOperationsAdmin(user)
  const filters = moneyFilters(search),
    period = reportPeriod(filters)
  const { db } = await requireMoneyReady(payload)
  const exporting = filters.format === 'csv'
  const match = {
    occurredAt: { $gte: period.start, $lt: period.end },
    ...(filters.orderId ? { orderId: filters.orderId } : {}),
  }
  const result = await db
    .collection(MONEY.entries)
    .aggregate<Document>(
      [
        { $match: match },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  records: { $sum: 1 },
                  collectedMinor: {
                    $sum: { $cond: [{ $eq: ['$kind', 'collection'] }, '$amountMinor', 0] },
                  },
                  refundedMinor: {
                    $sum: { $cond: [{ $eq: ['$kind', 'refund'] }, '$amountMinor', 0] },
                  },
                },
              },
            ],
            rows: [
              { $sort: { occurredAt: -1, _id: -1 } },
              { $skip: exporting ? 0 : (filters.page - 1) * 50 },
              { $limit: exporting ? 5001 : 50 },
              {
                $project: {
                  _id: 0,
                  id: '$_id',
                  orderId: 1,
                  orderNumber: 1,
                  kind: 1,
                  amountMinor: 1,
                  currency: 1,
                  method: 1,
                  reason: 1,
                  refundOf: 1,
                  occurredAt: 1,
                  recordedAt: 1,
                  actorId: 1,
                },
              },
            ],
          },
        },
      ],
      { maxTimeMS: 10000 },
    )
    .toArray()
  const summary = result[0]?.summary[0] || { records: 0, collectedMinor: 0, refundedMinor: 0 }
  if (exporting && summary.records > 5000)
    throw new RequestError('Narrow the range to at most 5,000 money events.', 413)
  let order = null
  if (filters.orderId) {
    const doc = await payload.findByID({
      collection: 'orders',
      id: filters.orderId,
      user,
      overrideAccess: false,
      depth: 0,
    })
    const balance = await db
      .collection<InternalRecord>(MONEY.balances)
      .findOne({ _id: String(doc.id) })
    order = {
      id: String(doc.id),
      orderNumber: doc.orderNumber,
      status: doc.status,
      total: doc.totalAmount,
      createdAt: doc.createdAt,
      collectedMinor: balance?.collectedMinor || 0,
      refundedMinor: balance?.refundedMinor || 0,
      hasEntries: Boolean(balance),
    }
  }
  return {
    filters,
    generatedAt: new Date().toISOString(),
    dateBasis: 'Actual money event date · Asia/Karachi; not order placement/confirmation date',
    summary: {
      records: summary.records,
      collectedMinor: summary.collectedMinor,
      refundedMinor: summary.refundedMinor,
      netMovementMinor: summary.collectedMinor - summary.refundedMinor,
    },
    order,
    rows: result[0]?.rows || [],
    pagination: {
      page: filters.page,
      totalPages: Math.max(1, Math.ceil(summary.records / 50)),
      totalRows: summary.records,
    },
  }
}
export async function moneyCSV(
  payload: Payload,
  user: User,
  report: Awaited<ReturnType<typeof moneyReport>>,
) {
  requireOperationsAdmin(user)
  if (
    report.filters.format !== 'csv' ||
    report.rows.length !== report.pagination.totalRows ||
    report.rows.length > 5000
  )
    throw new RequestError('A complete bounded CSV report is required.')
  const { db } = await requireMoneyReady(payload)
  const now = new Date()
  await db
    .collection<InternalRecord>(MONEY.audit)
    .insertOne({
      _id: randomUUID(),
      actorId: String(user.id),
      filters: report.filters,
      rows: report.rows.length,
      generatedAt: now,
      expiresAt: new Date(now.getTime() + 90 * 86400000),
    })
  const columns = [
    'id',
    'orderId',
    'orderNumber',
    'kind',
    'amountPKR',
    'currency',
    'method',
    'reason',
    'refundOf',
    'occurredAt',
    'recordedAt',
    'actorId',
  ]
  return (
    '\uFEFF' +
    [
      columns.map(csvCell).join(','),
      ...report.rows.map((row: Document) =>
        columns
          .map((key) =>
            csvCell(
              key === 'amountPKR'
                ? (row.amountMinor / 100).toFixed(2)
                : row[key] instanceof Date
                  ? row[key].toISOString()
                  : row[key],
            ),
          )
          .join(','),
      ),
    ].join('\r\n') +
    '\r\n'
  )
}
