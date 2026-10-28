import { privateJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { insightCSV, insightReport } from '@/lib/reports/insights'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    const report = await insightReport(payload, user, new URL(request.url).searchParams)
    if (report.filters.format !== 'csv') return privateJSON(report)
    return new Response(await insightCSV(payload, user, report), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="nski-historical-insights.csv"',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return requestError(error)
  }
}
