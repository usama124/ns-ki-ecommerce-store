# Checkout and receipt request origins

The previous mutation guard compared browser Origin only against
`NEXT_PUBLIC_SERVER_URL` (or `PAYLOAD_PUBLIC_SERVER_URL`). Consequently, a legitimate
Vercel preview request could be rejected if the configured canonical URL was the
production domain. Both checkout and private receipt uploads call this shared guard;
the rejection happens before order creation or R2 storage access, not as an R2 CORS
error.

The shared guard now accepts exact origins from:

- The configured canonical URL (same existing primary/fallback variable precedence).
- On Vercel only (`VERCEL=1`), the platform-supplied `VERCEL_URL` and
  `VERCEL_BRANCH_URL`, interpreted as HTTPS hostnames. No `*.vercel.app` wildcard.
- Optional server-only `APP_TRUSTED_ORIGINS`, for explicitly approved aliases such
  as a custom staging hostname or www/apex alias not represented by the variables
  above. Supply comma-separated complete origins, e.g.
  `https://staging.example.com,https://www.example.com`.

Vercel documents the deployment/branch hostnames in its
[system environment variables reference](https://vercel.com/docs/environment-variables/system-environment-variables).

Do not put credentials, wildcard patterns, paths, query strings or fragments into
the explicit alias list. Invalid configuration fails closed. URLs differ by scheme
and port as well as hostname. Changing environment values requires redeployment.
If using only Vercel's assigned preview URLs, no new custom variable is required.

Security behavior retained:

- Explicit `Sec-Fetch-Site: cross-site` requests are still rejected.
- Host/X-Forwarded-Host/X-Forwarded-Proto headers never extend the trusted set.
- A possibly internal/proxy `request.url` is not accepted as another origin when
  configured deployment origins are available. Only an otherwise unconfigured local
  server falls back to its request URL, as before.
- Unrelated preview projects, hostname suffix lookalikes, null origins and scheme/
  port mismatches are rejected. This is not an open CORS policy.
- Origin-less CLI/API requests retain their existing behavior; they must still pass
  endpoint-specific authentication, guest capabilities, input validation and limits.
- Private receipt ownership/token validation, one-receipt conditional writes,
  private bucket settings, checkout idempotency and server-calculated prices are
  unchanged.

Regression coverage includes trusted/untrusted origins, proxy-host spoofing,
invalid configuration, local fallback, custom aliases and full mocked checkout/
receipt route success on both assigned preview hostnames. No Vercel configuration,
real order or R2 object was changed by this fix.

Local verification: **643 tests passed in 55 files**, including 32 dedicated origin
cases plus checkout and private-receipt route regressions. Full TypeScript, targeted
ESLint and whitespace checks passed. No deployment or live browser/order test was
performed. If an order was created before its receipt failed, retry only the receipt
from the secure order details page instead of placing another order.
