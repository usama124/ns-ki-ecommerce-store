import type { ReportFilters, ReportRow } from './model'

export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value).replace(/\0/g, '')
  // Quote escaping alone does not prevent Excel/Sheets formula execution.
  if (typeof value !== 'number' && (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)))
    text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
export function reportCSV(filters: ReportFilters, rows: ReportRow[]) {
  const columns =
    filters.view === 'inventory'
      ? [
          'id',
          'variantId',
          'title',
          'productStatus',
          'category',
          'size',
          'sku',
          'stock',
          'stockState',
          'backorder',
          'price',
          'retailValue',
        ]
      : filters.view === 'products'
        ? ['id', 'title', 'productStatus', 'category', 'units', 'orders', 'merchandiseValue']
        : [
            'id',
            'orderNumber',
            'createdAt',
            'status',
            'paymentMethod',
            'city',
            'courier',
            'units',
            'subtotal',
            'shipping',
            'codFee',
            'total',
          ]
  return (
    '\uFEFF' +
    [
      columns.map(csvCell).join(','),
      ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(',')),
    ].join('\r\n') +
    '\r\n'
  )
}
