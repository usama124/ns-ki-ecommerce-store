import type { Payload } from 'payload'
import type { Document } from 'mongodb'
import type { User } from '@/payload-types'
import { checkRole } from '@/access/utilities'
import { RequestError } from '@/utilities/apiSecurity'
import { mongoCommerce, type InternalRecord } from '@/utilities/commerceDatabase'
import { reportPeriod } from './filters'
import {
  acceptedStatuses,
  periodChange,
  offsetDay,
  type ReportFilters,
  type ReportResult,
  type ReportRow,
} from './model'

export const REPORT_EXPORTS = 'nski_report_exports'
export const EXPORT_LIMIT = 5000
const PAGE_SIZE = 50
const options = { maxTimeMS: 10000, allowDiskUse: true }
function admin(user: User) {
  if (!checkRole(['admin'], user)) throw new RequestError('Action forbidden.', 403)
}
function storage(payload: Payload, user: User) {
  admin(user)
  if (payload.db.name !== 'mongoose')
    throw new RequestError('These operational reports currently require MongoDB.', 503)
  return mongoCommerce(payload)
}
const stringID = (field: unknown) => ({
  $convert: { input: field, to: 'string', onError: '', onNull: '' },
})
const shortText = (field: string, length = 200) => ({
  $substrCP: [{ $ifNull: [field, ''] }, 0, length],
})
const sumIf = (condition: Document, value: unknown = 1) => ({
  $sum: { $cond: [condition, value, 0] },
})
const accepted = { $in: ['$status', [...acceptedStatuses]] }
const orderSummary: Document = {
  $group: {
    _id: null,
    orders: { $sum: 1 },
    placedValue: { $sum: '$totalAmount' },
    acceptedOrders: sumIf(accepted),
    acceptedValue: sumIf(accepted, '$totalAmount'),
    subtotal: { $sum: '$subtotal' },
    shipping: { $sum: '$shippingFee' },
    codFees: { $sum: '$codFee' },
    units: { $sum: { $sum: '$items.quantity' } },
    cancelledOrders: sumIf({ $eq: ['$status', 'cancelled'] }),
    pendingVerification: sumIf({ $eq: ['$status', 'pending_verification'] }),
    codAcceptedValue: sumIf(
      { $and: [accepted, { $eq: ['$paymentMethod', 'cod'] }] },
      '$totalAmount',
    ),
    transferAcceptedValue: sumIf(
      { $and: [accepted, { $ne: ['$paymentMethod', 'cod'] }] },
      '$totalAmount',
    ),
  },
}
const orderColumns: Document = {
  $project: {
    _id: 0,
    id: stringID('$_id'),
    orderNumber: shortText('$orderNumber', 80),
    createdAt: { $dateToString: { date: '$createdAt', format: '%Y-%m-%dT%H:%M:%S.%LZ' } },
    status: { $ifNull: ['$status', 'unknown'] },
    paymentMethod: '$paymentMethod',
    city: shortText('$customer.city', 60),
    courier: { $ifNull: ['$fulfillment.courierName', 'Unassigned'] },
    subtotal: { $ifNull: ['$subtotal', 0] },
    shipping: { $ifNull: ['$shippingFee', 0] },
    codFee: { $ifNull: ['$codFee', 0] },
    total: '$totalAmount',
    units: { $sum: '$items.quantity' },
  },
}
function orderMatch(filters: ReportFilters, previous = false) {
  const period = reportPeriod(filters)
  const match: Document = {
    createdAt: {
      $gte: previous ? period.previousStart : period.start,
      $lt: previous ? period.previousEnd : period.end,
    },
  }
  if (filters.status !== 'all')
    match.status = filters.status === 'accepted' ? { $in: [...acceptedStatuses] } : filters.status
  if (filters.payment !== 'all') match.paymentMethod = filters.payment
  if (filters.city)
    match['customer.city'] = new RegExp(
      `^${filters.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i',
    )
  if (filters.courier) match['fulfillment.courierName'] = filters.courier
  if (filters.product)
    match.$expr = {
      $in: [
        filters.product,
        {
          $map: { input: { $ifNull: ['$items', []] }, as: 'item', in: stringID('$$item.product') },
        },
      ],
    }
  return { $match: match }
}
function summaryNumbers(row: Document | undefined, defaults: string[]) {
  const summary: Record<string, number> = Object.fromEntries(defaults.map((key) => [key, 0]))
  for (const [key, value] of Object.entries(row || {}))
    if (key !== '_id' && typeof value === 'number') summary[key] = Math.round(value * 100) / 100
  return summary
}
type Facets = {
  rows: ReportRow[]
  total: { value: number }[]
  summary: Document[]
  status?: ReportRow[]
  payment?: ReportRow[]
  courier?: ReportRow[]
  trend?: ReportRow[]
}
const countStage = [{ $count: 'value' }]
function detailStages(sort: Document, filters: ReportFilters, exporting: boolean): Document[] {
  return [
    { $sort: sort },
    ...(exporting ? [] : [{ $skip: (filters.page - 1) * PAGE_SIZE }]),
    { $limit: exporting ? EXPORT_LIMIT + 1 : PAGE_SIZE },
  ]
}
const groupBreakdown = (field: string): Document[] => [
  {
    $group: {
      _id: { $ifNull: [field, 'Unassigned'] },
      orders: { $sum: 1 },
      value: { $sum: '$totalAmount' },
    },
  },
  { $sort: { orders: -1, _id: 1 } },
  { $limit: 100 },
  { $project: { _id: 0, label: '$_id', orders: 1, value: { $round: ['$value', 2] } } },
]

/** Native fixed pipelines intentionally run only after explicit admin authorization. */
export async function getOperationalReport(
  payload: Payload,
  user: User,
  filters: ReportFilters,
  exporting = false,
): Promise<ReportResult> {
  const { db, adapter } = storage(payload, user)
  const names = Object.fromEntries(
    ['orders', 'products', 'categories', 'sizes'].map((key) => [
      key,
      adapter.collections[key].collection.collectionName,
    ]),
  )
  const ready = await db
    .collection<InternalRecord>('nski_commerce_config')
    .findOne({ _id: 'reports-v1', ready: true })
  let result: Facets,
    summary: Record<string, number>,
    comparison: ReportResult['comparison'] = null
  let definition: string
  if (filters.view === 'inventory') {
    const pipeline: Document[] = [
      ...(filters.product
        ? [{ $match: { $expr: { $eq: [stringID('$_id'), filters.product] } } }]
        : []),
      ...(filters.category
        ? [{ $match: { $expr: { $eq: [stringID('$primaryCategory'), filters.category] } } }]
        : []),
      { $unwind: '$variants' },
      {
        $lookup: {
          from: names.sizes,
          localField: 'variants.size',
          foreignField: '_id',
          as: 'size',
        },
      },
      {
        $lookup: {
          from: names.categories,
          localField: 'primaryCategory',
          foreignField: '_id',
          as: 'category',
        },
      },
      {
        $project: {
          _id: 0,
          id: stringID('$_id'),
          variantId: stringID({ $ifNull: ['$variants.id', '$variants._id'] }),
          title: shortText('$title'),
          productStatus: { $ifNull: ['$status', 'unknown'] },
          category: { $ifNull: [{ $first: '$category.name' }, 'Unassigned'] },
          size: { $ifNull: [{ $first: '$size.name' }, 'Unknown size'] },
          sku: shortText('$variants.sku', 120),
          stock: { $cond: [{ $isNumber: '$variants.stock' }, '$variants.stock', null] },
          backorder: { $eq: ['$variants.allowBackorder', true] },
          price: { $ifNull: ['$variants.pricePKR', '$basePricePKR'] },
        },
      },
      {
        $set: {
          stockState: {
            $switch: {
              branches: [
                { case: { $eq: ['$stock', null] }, then: 'unknown' },
                { case: { $lte: ['$stock', 0] }, then: 'out_of_stock' },
                { case: { $lte: ['$stock', filters.threshold] }, then: 'low_stock' },
              ],
              default: 'in_stock',
            },
          },
          retailValue: {
            $cond: [
              { $and: [{ $gt: ['$stock', 0] }, { $isNumber: '$price' }] },
              { $multiply: ['$stock', '$price'] },
              0,
            ],
          },
        },
      },
      ...(filters.stock === 'all'
        ? []
        : [
            {
              $match:
                filters.stock === 'in_stock'
                  ? { stock: { $gt: 0 } }
                  : { stockState: filters.stock },
            },
          ]),
    ]
    const sort =
      filters.sort === 'stock_asc'
        ? { stock: 1, title: 1, id: 1, variantId: 1 }
        : filters.sort === 'stock_desc'
          ? { stock: -1, title: 1, id: 1, variantId: 1 }
          : { title: 1, id: 1, variantId: 1 }
    const rows = await db
      .collection(names.products)
      .aggregate<Facets>(
        [
          ...pipeline,
          {
            $facet: {
              rows: detailStages(sort, filters, exporting),
              total: countStage,
              summary: [
                {
                  $group: {
                    _id: null,
                    variants: { $sum: 1 },
                    stockUnits: { $sum: { $max: ['$stock', 0] } },
                    inStock: sumIf({ $gt: ['$stock', 0] }),
                    lowStock: sumIf({ $eq: ['$stockState', 'low_stock'] }),
                    outOfStock: sumIf({ $eq: ['$stockState', 'out_of_stock'] }),
                    unknownStock: sumIf({ $eq: ['$stockState', 'unknown'] }),
                    backorderEnabled: sumIf({ $eq: ['$backorder', true] }),
                    retailStockValue: { $sum: '$retailValue' },
                  },
                },
              ],
            },
          },
        ],
        options,
      )
      .toArray()
    result = rows[0]
    summary = summaryNumbers(result?.summary[0], [
      'variants',
      'stockUnits',
      'inStock',
      'lowStock',
      'outOfStock',
      'unknownStock',
      'backorderEnabled',
      'retailStockValue',
    ])
    definition = `Current variants across all catalog statuses. Low stock: 1–${filters.threshold}; in-stock includes low stock. Backorder permission is not stock. Retail value uses current regular prices, not inventory cost. Dates/order filters do not apply.`
  } else if (filters.view === 'products') {
    const base: Document[] = [
      orderMatch(filters),
      { $unwind: '$items' },
      ...(filters.product
        ? [{ $match: { $expr: { $eq: [stringID('$items.product'), filters.product] } } }]
        : []),
      {
        $group: {
          _id: { product: '$items.product', order: '$_id' },
          units: { $sum: '$items.quantity' },
          merchandiseValue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
        },
      },
      {
        $group: {
          _id: '$_id.product',
          units: { $sum: '$units' },
          merchandiseValue: { $sum: '$merchandiseValue' },
          orders: { $sum: 1 },
        },
      },
      // Union the current catalog so zero-order products are visible too.
      {
        $unionWith: {
          coll: names.products,
          pipeline: [
            {
              $project: {
                _id: 1,
                units: { $literal: 0 },
                merchandiseValue: { $literal: 0 },
                orders: { $literal: 0 },
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: '$_id',
          units: { $sum: '$units' },
          merchandiseValue: { $sum: '$merchandiseValue' },
          orders: { $sum: '$orders' },
        },
      },
      ...(filters.product
        ? [{ $match: { $expr: { $eq: [stringID('$_id'), filters.product] } } }]
        : []),
      {
        $lookup: {
          from: names.products,
          localField: '_id',
          foreignField: '_id',
          pipeline: [{ $project: { title: 1, primaryCategory: 1, status: 1 } }],
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      ...(filters.category
        ? [{ $match: { $expr: { $eq: [stringID('$product.primaryCategory'), filters.category] } } }]
        : []),
      {
        $lookup: {
          from: names.categories,
          localField: 'product.primaryCategory',
          foreignField: '_id',
          as: 'category',
        },
      },
      {
        $project: {
          _id: 0,
          id: stringID('$_id'),
          title: { $ifNull: ['$product.title', 'Deleted / unavailable product'] },
          productStatus: { $ifNull: ['$product.status', 'unavailable'] },
          category: { $ifNull: [{ $first: '$category.name' }, 'Unassigned / unavailable'] },
          units: 1,
          orders: 1,
          merchandiseValue: { $round: ['$merchandiseValue', 2] },
        },
      },
    ]
    const sort =
      filters.sort === 'title'
        ? { title: 1, id: 1 }
        : filters.sort === 'units_desc'
          ? { units: -1, id: 1 }
          : { merchandiseValue: -1, id: 1 }
    result = (
      await db
        .collection(names.orders)
        .aggregate<Facets>(
          [
            ...base,
            {
              $facet: {
                rows: detailStages(sort, filters, exporting),
                total: countStage,
                summary: [
                  {
                    $group: {
                      _id: null,
                      products: { $sum: 1 },
                      units: { $sum: '$units' },
                      merchandiseValue: { $sum: '$merchandiseValue' },
                      zeroOrderProducts: sumIf({ $eq: ['$orders', 0] }),
                    },
                  },
                ],
              },
            },
          ],
          options,
        )
        .toArray()
    )[0]
    summary = summaryNumbers(result?.summary[0], [
      'products',
      'units',
      'merchandiseValue',
      'zeroOrderProducts',
    ])
    definition =
      'Order placement cohort, selected current statuses. Merchandise = accepted line price × quantity; excludes shipping/COD fees. Distinct orders per product; do not add these counts across products. Names/categories/status use the current catalog, not historical snapshots. Includes current zero-order products (including drafts); no launch-date adjustment.'
  } else {
    const sort =
      filters.sort === 'oldest'
        ? { createdAt: 1, _id: 1 }
        : filters.sort === 'value_desc'
          ? { totalAmount: -1, _id: 1 }
          : { createdAt: -1, _id: -1 }
    const [current, previous] = await Promise.all([
      db
        .collection(names.orders)
        .aggregate<Facets>(
          [
            orderMatch(filters),
            {
              $facet: {
                rows: [...detailStages(sort, filters, exporting), orderColumns],
                total: countStage,
                summary: [orderSummary],
                status: groupBreakdown('$status'),
                payment: groupBreakdown('$paymentMethod'),
                courier: groupBreakdown('$fulfillment.courierName'),
                trend: [
                  {
                    $group: {
                      _id: {
                        $dateToString: {
                          date: '$createdAt',
                          format: '%Y-%m-%d',
                          timezone: 'Asia/Karachi',
                        },
                      },
                      orders: { $sum: 1 },
                      value: { $sum: '$totalAmount' },
                    },
                  },
                  { $sort: { _id: 1 } },
                  {
                    $project: { _id: 0, day: '$_id', orders: 1, value: { $round: ['$value', 2] } },
                  },
                ],
              },
            },
          ],
          options,
        )
        .toArray(),
      db
        .collection(names.orders)
        .aggregate<Document>([orderMatch(filters, true), orderSummary], options)
        .toArray(),
    ])
    result = current[0]
    const keys = [
      'orders',
      'placedValue',
      'acceptedOrders',
      'acceptedValue',
      'subtotal',
      'shipping',
      'codFees',
      'units',
      'cancelledOrders',
      'pendingVerification',
      'codAcceptedValue',
      'transferAcceptedValue',
    ]
    summary = summaryNumbers(result?.summary[0], keys)
    summary.averageAcceptedValue = summary.acceptedOrders
      ? Math.round((summary.acceptedValue / summary.acceptedOrders) * 100) / 100
      : 0
    summary.cancellationRate = summary.orders
      ? Math.round((summary.cancelledOrders / summary.orders) * 10000) / 100
      : 0
    const prior = summaryNumbers(previous[0], keys)
    comparison = Object.fromEntries(
      ['orders', 'placedValue', 'acceptedOrders', 'acceptedValue'].map((key) => [
        key,
        periodChange(summary[key], prior[key]),
      ]),
    )
    definition =
      'Orders placed in the selected Karachi calendar range; end date inclusive. Status/payment filters use current values. Accepted = confirmed, processing, shipped or delivered. Values include shipping/COD unless labeled merchandise. COD acceptance is not cash collection. Product ID selects whole orders containing that product, not only its lines. Prior comparison uses the immediately preceding equal-length period and identical filters.'
    const days = new Map((result?.trend || []).map((row) => [row.day, row]))
    result.trend = []
    for (let day = filters.start; day <= filters.end; day = offsetDay(day, 1))
      result.trend.push(days.get(day) || { day, orders: 0, value: 0 })
  }
  const totalRows = result?.total[0]?.value || 0
  if (exporting && totalRows > EXPORT_LIMIT)
    throw new RequestError(
      `Export exceeds ${EXPORT_LIMIT} rows. Narrow the filters; background exports are not available yet.`,
      413,
    )
  return {
    filters,
    generatedAt: new Date().toISOString(),
    dateBasis:
      filters.view === 'inventory'
        ? 'Current stock as of request time; not historical stock'
        : 'Order placed-at cohort · Asia/Karachi (UTC+05:00)',
    definition,
    summary: {
      ...summary,
      ...('averageAcceptedValue' in summary && !summary.acceptedOrders
        ? { averageAcceptedValue: null }
        : {}),
      ...('cancellationRate' in summary && !summary.orders ? { cancellationRate: null } : {}),
    },
    comparison,
    rows: result?.rows || [],
    trend: result?.trend || [],
    breakdowns: {
      status: result?.status || [],
      payment: result?.payment || [],
      courier: result?.courier || [],
    },
    pagination: {
      page: exporting ? 1 : filters.page,
      totalPages: Math.max(1, Math.ceil(totalRows / PAGE_SIZE)),
      totalRows,
      pageSize: PAGE_SIZE,
    },
    unavailable: [
      'Actual money entries are in the separate recorded payments & refunds section, not this placement cohort. Profit and courier settlement remain unavailable.',
      'Pre-activation milestones/stock movements cannot be reconstructed; new tracked facts are in Historical operations.',
      'GA4 traffic, product views and cart abandonment are not connected to admin reports.',
    ],
    exportReady: Boolean(ready),
  }
}

/** Administrator-only deployment step, never implicit DDL on report reads. */
export async function initializeReports(payload: Payload, user: User) {
  const { db, adapter } = storage(payload, user)
  if (!(await db.listCollections({ name: REPORT_EXPORTS }, { nameOnly: true }).hasNext()))
    await db.createCollection(REPORT_EXPORTS)
  await db.collection(REPORT_EXPORTS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await adapter.collections.orders.collection.createIndex(
    { createdAt: 1, status: 1, paymentMethod: 1 },
    { name: 'reports_placed_status_payment' },
  )
  await adapter.collections.products.collection.createIndex(
    { primaryCategory: 1 },
    { name: 'reports_primary_category' },
  )
  await db
    .collection<InternalRecord>('nski_commerce_config')
    .updateOne({ _id: 'reports-v1' }, { $set: { ready: true } }, { upsert: true })
}
