# N’s KI ecommerce QA audit

24 October 2026 · repository baseline `fd4210f` · audit, not remediation

**Subsequent update:** the user approved fixes after this initial audit. Findings/results below are retained as historical evidence. See [remediation verification](remediation-verification.md) for implemented changes, 368 passing tests and remaining deployment/integration prerequisites.

## A. Executive summary

**NOT READY for sign-off.** A demonstrated P1 order-editing defect lets item quantities and order totals disagree. Confirmed P2 defects include COD paid/verified copy, malformed-cart crashes and an external login redirect. Reporting has code-confirmed scale limits and checkout has unassociated form labels. Mobile production-build cart/login interactions were executed, but browser checkout is blocked by local Origin rejection and real storage/email integrations remain unverified.

The supplied production MongoDB archive was integrity checked and restored into isolated baseline and working databases. The baseline contains **16 published products, 3 categories, 86 media records, 9 sizes, 1 user and zero orders**. Only synthetic users/catalog/orders and test configuration overlays were written to the working copy. No production writes, real payments, email sends or receipt access occurred. No legacy-order migration is needed for this backup.

Results and remaining limitations are itemized below and in the [defect register](bug-register.md). All application fixes require separate approval.

## B. Application architecture

- Next.js 16.3.3 App Router, React 19.2.6, Payload CMS 3.88.0, TypeScript and Node 22. MongoDB/Mongoose is the restored deployment adapter. SQL adapter configuration exists, but new native-commerce commands require MongoDB and fail closed otherwise; SQL parity was not tested.
- Payload users/session authentication; customer/admin roles and collection/field access controls. Guest orders use signed, expiring order-access tokens. Email address alone does not establish ownership. Administrator interface is `/store-admin`, not legacy `/admin`.
- Catalog: products, variants/size relationships, main/subcategories, media, sale/site-settings globals. Parent-category product filtering includes descendants. Published-only storefront queries, responsive stored media sizes and server-owned pricing/shipping.
- Cart: browser localStorage (`nski_cart`, legacy fallback), React provider; no server cart/account merge, explicit TTL or cross-tab synchronization found. Checkout performs authoritative stock/price validation rather than trusting browser amounts.
- Payment methods: COD, bank transfer, JazzCash, EasyPaisa. Digital methods are manual-reference/optional-receipt workflows, not online gateway settlements. No implemented card gateway, refunds, coupons, tax engine or automated courier dispatch was evidenced.
- Order statuses: pending_verification, confirmed, processing, shipped, delivered, cancelled. COD starts confirmed; digital starts pending_verification. Order status is not a separate paid/settled ledger.
- Native Mongo commerce collections hold readiness/config, checkout idempotency, stock movements, email outbox and rate limits. Snapshot transactions couple order/stock/claim/outbox writes; bounded retries handle conflicts and uncertain commits. Administrator inventory writes use the ledger; stale product forms cannot directly overwrite allocated stock.
- Public catalog media uses R2; receipts use a separate private bucket and authorized proxy endpoint, never public media IDs. WebP decoding/compression and upload constraints exist. Real bucket configuration/privacy was not exercised.
- Notifications: durable outbox, leased worker, bounded retry/backoff and provider idempotency. Production dispatch requires Resend/configuration plus a scheduler or manual administrator dispatch. Payload account-email transport is a separate integration. No deployed scheduler or actual inbox delivery was verified.
- Caching: tagged storefront category/shell cache; product availability/pricing remain authoritative server queries. Database pool options include bounded maxPoolSize, idle/connection/selection/queue timeouts. No Redis integration was found; connection capacity is per instance, not a fleet-wide guarantee.

Route classification:

- Public: `/`, `/shop`, `/shop/[category]`, `/products/[slug]`, `/sale`, published CMS pages, sitemap, authentication pages, checkout, exact-contact order tracking.
- Customer/owner: account, addresses, order history/detail. Guest confirmation/detail/receipt access needs a valid scoped token.
- Administrator: store-admin, orders/status, inventory/update, sale/settings/stats/commerce dispatch endpoints; collection/field policies also apply to generic REST/GraphQL.
- Preview/seed/scheduler: secret/admin gates must be validated independently; no payment webhook workflow was identified. Do not infer gateway support from old template tests.

## C. Test environment

Original archive: user-supplied gzip mongodump, mounted read-only; gzip integrity and namespace dry run succeeded. Two restores: `nski_qa_baseline` (untouched) and `nski_qa_working` (fixtures/test overlays). MongoDB 8 replica set `nski-test` runs in task-specific Docker containers on an internal network. Snapshot source is under `/tmp/nski-qa-20261024.W0igvM`, not the live repository. No production `.env` is mounted.

QA app has an explicit local Mongo URI, dummy Payload secret, blank R2/email configuration and outbound-blocked networking. A fixed-target local proxy exposes localhost:3105. Chromium requests to non-local hosts are aborted, including Analytics/R2; aborted external assets are **not production defects**. The proxy does not initially forward WebSocket upgrades and rewrites the server's effective origin; these are harness constraints.

Synthetic roles: administrator, customer, unrelated customer. Synthetic fixtures: parent/child category, published suit (two variants), draft product, last-unit product, generated 600×900 WebP, shipping/payment test overlays. No real credentials or customer records are included in evidence. The one-shot seed refuses a second fixture insertion; restore a fresh working copy before reseeding.

## D. Coverage matrix

Counts below are automation-case counts, not percentages of every possible behavior. One case may contain multiple assertions. The independently tracked [case inventory](test-cases.md) separates blocked and unexecuted scenarios.

- Existing Vitest business/security regression: 254 designed/executed, **254 passed**, 0 failed. Tests largely mock Payload/external boundaries; not equivalent to restored-DB E2E.
- Existing isolated Chromium regressions: 23 designed/executed, **23 passed**, 0 failed. Image cropping/WebP, responsive media, checkout repricing/retry/receipts, mobile layouts/reels/video docking; mocked components/services.
- Native Mongo replica-set integrity: 15 designed/executed, **15 passed**, 0 failed after resolving local harness connectivity/config-loader issues. Separate disposable synthetic DB, not restored baseline.
- Restored-app HTTP/browser suite: final production-build run has **18 executed, 13 passed, 5 failed assertions**. Four failures confirm defects (money, cart, redirect, COD copy); one is browser checkout blocked by local Origin rejection. It is not evidence of live checkout failure. Earlier development hydration failures are superseded.
- Static checks: TypeScript passed; lint failed (31 errors, 265 warnings). Source-route/schema/access/integration inspection is review evidence, not a passed browser journey.
- External integrations: real storage upload/view/privacy, provider inbox delivery, live apex/www and deployed analytics verification **BLOCKED** by isolation/access restrictions.
- Whole-browser purchase/lifecycle, multi-day returns, cross-device carts, password recovery inbox and exhaustive assistive-technology review: partial/blocked/not tested as specified in section M. Across the four automation layers: **310 executed, 305 passed, 5 failed assertions** (four confirmed defects, one Origin blocker); not 310 complete customer journeys. No assertion that every page is fully tested.

## E. Complete customer journey results

Entry and discovery: local public routes render; published/draft separation and parent-category descendant products pass restored-DB HTTP assertions. Three nonexistent routes terminate without a redirect loop and include noindex; streamed Next notFound may have HTTP 200. This is not proof of correct status codes everywhere. Product desktop/mobile visibility and lack of horizontal overflow were checked at 1440/390 widths; this alone does not prove interactive hydration.

Variant/cart/checkout: isolated component regressions pass. Production-build execution resolved the development hydration blocker. Full-app mobile variant selection, add-to-bag, refresh persistence and populated checkout pass, with a sanitized screenshot. Malformed storage crashes during hydration (QA-B05); valid login attempts the external redirect (QA-B06). Mobile Complete Order reaches the real API but receives 403 due local Origin handling; confirmation/cart-clear assertions are unexecuted. No literal multi-day waiting performed.

Checkout API: authoritative totals, fractional-quantity rejection, COD creation, replay and ownership, all three manual digital methods, cancellation stock restoration, exact-contact tracking and private receipt authorization were exercised using synthetic users/orders. Full browser form submission through this proxy is not a signed-off production-shaped journey.

Post-order: customers can read their own order via authenticated API; another customer is denied. Tracking omits private customer/items data. Private receipt endpoints deny anonymous/foreign/forged-token access and fail closed for authorized callers when isolated storage is absent. Administrator item editing exposes QA-B01. Customer account-address components are placeholders.

## F. Payment workflow results

COD: order creation totals Rs. 1,350 for the synthetic Rs. 1,000 item + Rs. 250 shipping + Rs. 100 COD; starts confirmed and decrements stock once. Reusing the identical idempotency key returns the same order. This is not proof of cash collection. Confirmation copy incorrectly implies paid/verified (QA-B02).

Bank transfer: synthetic reference creates pending_verification, total Rs. 1,250 without COD fee. No bank transfer performed. Receipt ownership/fail-closed checks pass; real upload/storage/admin viewing is blocked.

JazzCash and EasyPaisa: each synthetic reference creates a pending_verification Rs. 1,250 order. No wallet API call or payment was initiated. Unique references per test; manual verification remains an administrator workflow.

Mock/unit coverage exercises invalid/missing references, duplicate references, proof validation, quote changes and insecure media rejection. Real gateway callback/replay/refund scenarios are not applicable to the evidenced manual implementation, rather than passed tests.

## G. Cart and inventory

Native real-Mongo tests pass last-unit competing purchases, concurrent identical retries, response-loss recovery, atomic rollback of claim/order/stock/outbox, changed-quote nonreservation, cancel/repeated cancel/reactivation, item reconciliation, concurrent cancellation, stock-edit protection, reserved-variant removal and legacy fail-closed cancellation. Restored-app HTTP cancellation also restores stock exactly once.

Browser cart contents are not trusted for final prices/availability. Stock/price changes after leaving the site must be reconfirmed at checkout. Invalid-object recovery fails (QA-B05); schema migration, storage failures, cross-tab changes and long-lived return behavior remain gaps/policy decisions. Normal same-browser refresh persistence passes. No evidence supports cross-device carts.

## H. Order lifecycle

Supported enum and current initial states were confirmed from code and API. Cancellation/retry inventory invariants pass. Arbitrary enum transitions are accepted by the status API; allowed transition policy needs explicit business requirements. No separate digital-payment verification record or COD collection accounting was found. Editing active line quantities reconciles inventory without financial recalculation (QA-B01). Internal administrator notes are excluded from customer cancellation email content by tested regressions.

## I. Security and privacy

Positive evidence: unauthenticated administrator mutations denied; unrelated customer order/receipt denied; forged guest token denied; exact-contact tracking returns minimal data with private/no-store. Role field write protection is implemented and exercised separately. Existing tests cover pricing tampering, unsafe uploads, secret/private media access, ID ownership, request body limits, shared rate counters and private headers.

No claim of exhaustive penetration testing. External login redirect and malformed-cart crashes are now runtime-confirmed (QA-B06/B05); no XSS or production data exposure claimed. Role escalation attempt was checked through the administrator-readable role field and denied; customer responses intentionally hide roles. Tokens/cookies/email bodies are excluded from persisted evidence. Live R2 media/privacy and full accessibility remain unverified.

## J. Integration failures / prerequisites

- Mongo restore/indexing succeeds and native transaction tests pass. Baseline has no commerce readiness marker/native commerce collections; initializer was run only in the working DB. Production deployment must run the explicit commerce initializer; empty-order backup means no legacy orders to migrate.
- Private R2 is deliberately unconfigured in QA: authorized receipt operations return 503. This demonstrates fail-closed behavior, not successful storage integration. Provider CORS, actual public-access settings, encryption/retention and old public receipt exposure remain unverified.
- Email outbox is queued, not sent. Provider acceptance in mocked worker tests is not inbox delivery. Account password-reset transport and order-worker dispatch require separate verified configuration.
- Production compilation succeeds and browser hydration/cart/login work. Browser checkout still returns 403 with Origin; CLI requests without Origin succeed. Verify trusted external-origin handling in a production-shaped staging deployment before launch. Early harness route/cache/role-field assumptions were investigated, not counted as vulnerabilities.

## K. Performance findings

Five sequential local development full-response samples per public route, alongside QA activity; no load/concurrency capacity claim. Includes warmup/compilation noise, all 25 requests HTTP 200. Milliseconds, nearest-rank p95/p99 with n=5 both equal maximum and are statistically weak:

- `/`: 1082, 1027, 1133, 1077, 1318; median 1082; p95/p99 1318; final HTML payload 227,580 bytes.
- `/shop`: 3150, 549, 608, 586, 609; median 608; p95/p99 3150; 212,522 bytes.
- Synthetic category: 239, 198, 168, 2769, 232; median 232; p95/p99 2769; 95,175 bytes.
- Synthetic product: 332, 206, 213, 247, 255; median 247; p95/p99 332; 89,438 bytes.
- `/shop?q=qa-audit`: 206, 229, 224, 184, 178; median 206; p95/p99 229; 94,101 bytes.

These are not LCP, TTFB-only, production timings or Core Web Vitals. No meaningful production p99, query profiler, connection-exhaustion test, receipt latency or supported-user count measured. Prioritize staging production-build RUM/Lighthouse, indexed server-side report pagination, query timing and controlled gradual load tests. Existing responsive-media browser tests prove size selection for the tested fixture/DPR combinations, not live CDN performance.

## L. Defect register

See [bug-register.md](bug-register.md) for complete reproduction/remediation detail. Confirmed: QA-B01 P1 financial inconsistency; QA-B02 P2 COD copy; QA-B03 P2 reporting truncation (code boundary); QA-B04 P2 label associations (code); QA-B05 P2 malformed cart crash; QA-B06 P2 login open redirect.

Potential issues and requirements are explicitly separated as QA-R01–R06. No confirmed P0 claimed.

## M. Blocked and untested scenarios

- BLOCKED: actual private-R2 upload/view from customer/admin and privacy settings; public image delivery/CORS; real Resend/account emails/inbox; provider outage recovery against a real sandbox. No test service credentials supplied and QA egress intentionally disabled.
- BLOCKED: live apex/www smoke through available web tooling (tool reported inaccessible; not evidence of website outage), DNS/TLS/canonical/production sitemap verification and GA reporting. No live order or login attempted.
- BLOCKED: complete browser purchase/confirmation due 403 Origin rejection in QA-16. Production build/cart persistence/login hydration succeeded; do not keep these marked blocked. Digital payment methods passed API and isolated component tests, not complete full-app browser purchases.
- NOT TESTED: exhaustive catalog search permutations, full pagination/filter/sort combinations, every footer link/CMS page, multi-day browser history, cookie expiry/clock scenarios, cross-tab/device behavior, saved-address workflow, deployed scheduler execution, large-report boundary fixtures, exhaustive generic GraphQL/API fuzzing, keyboard/screen-reader/contrast audit, browsers other than Chromium, real mobile video/provider behavior and production capacity.
- NEEDS REVIEW: refunds/returns/payment settlement reporting, allowed status graph, abandoned-cart definition/retention, guest-to-account attribution, saved addresses and actual operational reports. Absent features cannot pass invented requirements.

## N. Release readiness

**NOT READY for the complete requested journey.** Resolve QA-B01 and payment messaging; verify production-shaped interactive checkout and storage/email integration. The tested Mongo transaction and isolated component scope passes, but this does not certify the full release or existing live deployment. No historical production orders were present to validate.

## O. Prioritized remediation plan

- P0: no confirmed finding; keep production secrets/private receipts protected and do not deploy uninitialized commerce.
- P1: fix/restrict order line financial edits atomically; production-shaped browser checkout verification before launch sign-off.
- P2: correct COD email semantics; paginate/aggregate reports consistently; accessible checkout labels; fix confirmed cart schema handling and external redirects.
- P3: define transition guidance, address empty-state UX and actionable failures where supported by evidence.
- P4: lint cleanup, CI safe test isolation, staging service sandbox, monitoring/outbox scheduler runbook and measured performance budgets.

## P. Regression test plan

Run existing 254 Vitest, 23 isolated Chromium and 15 native-Mongo cases, TypeScript and lint. Re-run restored-app QA with a fresh working DB and same synthetic seed. Keep QA-07 and COD-copy expectations failing until approved fixes; never weaken them to conceal defects. Add large-report boundaries, financial mutations, hydrated mobile/desktop full purchase, receipt provider contract tests, password-reset testing, malformed-storage recovery, stale-cart requote, ownership and same-origin browser submission. Ensure traces/screenshots never contain real accounts/tokens/receipts.

## Q. Recommendations

Treat financial amounts and inventory allocations as one coherent order revision. Separate confirmation, payment verification, cash collection and revenue definitions. Prefer aggregation/filter pagination to loading bounded history and pretending it is complete. Add a staging environment with synthetic email/storage, explicit commerce initialization and non-production analytics. Add CI using isolated configs, test metadata/status artifacts and per-journey acceptance criteria; block accidental dotenv/localhost production reuse. Measure server latency and customer Web Vitals separately, and alert on stock/outbox/readiness failures. Decide which absent workflows are actually in launch scope.

## R. Test execution evidence

See [test-execution-summary.md](test-execution-summary.md), [test-cases.md](test-cases.md), [test-plan.md](test-plan.md) and `test-artifacts/` for the run ledger. Tests added under `tests/qa/`, isolated config `playwright.qa.config.ts`. Application `src/`, production `.env` and dependency manifests were not edited. Temporary restored data remains sensitive and local; never commit DB archives, working-copy media, credentials or session traces.
