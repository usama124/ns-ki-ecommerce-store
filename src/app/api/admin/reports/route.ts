import { randomUUID } from 'node:crypto'
import { privateJSON, requestError, requireAdmin, RequestError } from '@/utilities/apiSecurity'
import { mongoCommerce, type InternalRecord } from '@/utilities/commerceDatabase'
import { parseReportFilters } from '@/lib/reports/filters'
import { getOperationalReport, REPORT_EXPORTS } from '@/lib/reports/service'
import { reportCSV } from '@/lib/reports/csv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    const search = new URL(request.url).searchParams
    const filters = parseReportFilters(search)
    const exporting = search.get('format') === 'csv'
    const report = await getOperationalReport(payload, user, filters, exporting)
    if (!exporting) return privateJSON(report)
    if (!report.exportReady)
      throw new RequestError('Prepare reporting indexes before exporting.', 503)
    // Log exports, not customer/contact data or CSV content. Fail closed if audit fails.
    const now = new Date()
    await mongoCommerce(payload)
      .db.collection<InternalRecord>(REPORT_EXPORTS)
      .insertOne({
        _id: randomUUID(),
        actorId: String(user.id),
        filters: { ...filters, page: 1 },
        rows: report.rows.length,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 90 * 86400000),
      })
    return new Response(reportCSV(filters, report.rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="nski-${filters.view}-${filters.start}-${filters.end}.csv"`,
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return requestError(error)
  }
}
