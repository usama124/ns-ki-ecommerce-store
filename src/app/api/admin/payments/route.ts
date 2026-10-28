import { privateJSON, readJSON, requestError, requireAdmin } from '@/utilities/apiSecurity'
import { recordMoney } from '@/utilities/paymentLedger'
import { moneyCSV, moneyReport } from '@/lib/payments/report'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function POST(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    return privateJSON(await recordMoney(payload, user, await readJSON(request, 2048)))
  } catch (error) {
    return requestError(error)
  }
}
export async function GET(request: Request) {
  try {
    const { payload, user } = await requireAdmin(request)
    const report = await moneyReport(payload, user, new URL(request.url).searchParams)
    if (report.filters.format !== 'csv') return privateJSON(report)
    return new Response(await moneyCSV(payload, user, report), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="nski-recorded-money.csv"',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return requestError(error)
  }
}
