# Admin reporting — batch 3

Update: the history/stock portion of batch 4 is now implemented in a separate expandable history view within Reports. See [historical operations](historical-operations.md) for explicit activation, coverage limitations, rollout and the latest 536-test verification. The cohort/current-state definitions below remain unchanged.

Further update: **Recorded payments & refunds (actual money)** now supports explicitly entered collections/partial refunds, transactional balances and audited CSV. See [payment recording](payment-recording.md) for activation, financial edit/deletion locks, recovery behavior and verification. Money-event reports are separate from the placement cohorts below; settlement/profit and GA4 refunds remain unavailable.

Implemented locally on 25 October 2026. Open **Reports** in the Payload sidebar, or `/store-admin/reports`. Only administrators can use the view, report APIs, suggestions, setup and CSV exports. No Google credentials are needed.

## Available now

- **Overview / Orders:** order counts, placed value, currently accepted orders/value, merchandise subtotal, shipping/COD charges, units, pending verification, cancellations and accepted-order average. Daily placement rows and current status/payment/courier breakdowns are available under expandable sections. The prior-period comparison uses the immediately preceding equal-length period and the same filters.
- **Products:** merchandise value, units and distinct orders per product, with current catalog products having zero matching orders included. Defaults to accepted statuses. Multiple sizes/lines for one product in an order count as one order for that product; do not add product order counts to obtain store order totals. Deleted product IDs with retained order lines remain visible as unavailable catalog records.
- **Inventory:** all matching current product variants, including draft products, with stock, size, SKU, backorder permission and regular retail price. Counters include positive stock, low stock, out-of-stock and unknown stock across the full match, not just the page. Low stock is 1 through the chosen threshold (default 5); in-stock includes low-stock variants. Backorder permission does not imply physical stock. Retail stock value is **not cost valuation or profit** and does not apply temporary sale pricing.
- **Payments & fulfillment:** current payment method, order status and courier breakdowns for the selected placement cohort, with accepted COD and confirmed-transfer order values. Collected cash, refunds and settlement remain explicitly unavailable.
- Details have deterministic sorting, 50-row pagination and links to the relevant Payload record. Filters persist in the URL and browser back/forward works. Product/category suggestions are limited to 200 records; any valid record ID can still be entered manually. This suggestion limit does not limit report totals.

## Read the numbers correctly

Dates are **order placement dates**, not confirmation/payment/shipping/delivery dates. UI endpoints are inclusive Karachi calendar dates; queries convert them to inclusive start/exclusive end UTC bounds. Supported windows are 1–366 days. Today, yesterday, last seven/thirty days, this/previous month and custom ranges are supported.

Status filters describe the **current** state of existing records in the selected placed-order cohort. Accepted means confirmed, processing, shipped or delivered. Accepted order value includes stored shipping and COD charges; product merchandise value excludes both. COD acceptance is not cash collection, and an operator's transfer confirmation is not a bank/courier settlement record. Deleted orders are not reconstructed. Average/cancellation percentages without a denominator are unavailable, not fabricated zero rates. Prior-period percentage change is unavailable when the prior value is zero.

Order reports filtered by Product ID include the **whole matching order**, including other products and fees. Product performance filters include only that product's item value/units. Category filters use **current primary category only** for additive product/inventory grouping; secondary/multiple categories are not independently summed. Catalog names, statuses and categories are current, not immutable historical snapshots. Current zero-order products include drafts and recent launches, so zero is not by itself proof of underperformance.

Inventory is an **as-of-request current-stock view**, not a historical range report. Dates do not filter inventory. Unknown/missing stock stays unknown rather than becoming zero. Positive known stock contributes to stock units/retail value; a zero price override is respected. Current data can change between report and export requests; generation time is displayed, not a promised point-in-time accounting lock.

All reported totals cover the full matching dataset independently of detail pagination. Failures display an error and remove stale totals; they do not become plausible zero reports. Responses are private/no-store and there is no shared aggregate cache. The existing dashboard-stats endpoint now counts documents without loading all of them and uses the same accepted-status grand-total definition as the orders dashboard.

## One-time setup and CSV exports

1. Deploy the code/import map through your normal release workflow; no new environment variables are required for reporting. This implementation did not deploy to production.
2. Log in as an administrator and open Reports. JSON reports work immediately on the transaction-enabled MongoDB adapter already required by commerce.
3. Click **Prepare reporting indexes & exports** once, or issue same-origin `POST /api/admin/reports/initialize`. This explicitly prepares reporting indexes and a private native export-audit collection. Reads do not perform implicit DDL. Setup does not change products, orders, stock or commerce readiness. Review/schedule index creation for large production databases under your normal backup/change process.
4. Apply filters, then click **Export all matching rows (CSV)**. The export uses the applied report filters (not unsaved form edits or only the visible page). It is UTF-8 CSV with a BOM, CRLF rows, escaped quotes and spreadsheet formula neutralization. Treat downloaded files as private operational data.
5. Every successful generated export logs its administrator ID, normalized filters, row count and generation time. Audit records expire after 90 days through asynchronous MongoDB TTL cleanup. CSV content and customer details are not stored in the audit collection; the log is not proof that a download reached the browser.

Synchronous exports support **at most 5,000 matching rows**. Larger requests return HTTP 413 and require narrower filters; they are never silently truncated. Background exports are not implemented yet. Export failure/audit persistence failure returns an error instead of a partial file. Order CSV contains operational identifiers/statuses, city/courier and totals; it excludes customer names, emails, phones, addresses, payment references, notes, access tokens and receipts. Dates in `createdAt` CSV cells are UTC ISO timestamps; all monetary values are PKR. Inventory CSV is a current snapshot even though the common filename includes the selected filter dates.

## Implementation and security

- UI: `src/components/admin/ReportsView/`; route registration in `src/payload.config.ts` and the generated admin import map. Existing upload-handler import entries are retained for production R2 configuration.
- Pure contracts/calendar/CSV helpers and fixed report pipelines: `src/lib/reports/`.
- `GET /api/admin/reports` accepts only validated, allowlisted filters/sorts. `format=csv` selects export mode. Unsupported/duplicate filters and irrelevant stock/order/category filters are rejected.
- `GET /api/admin/reports/options` returns bounded product/category suggestions using access-controlled Local API reads. `POST /api/admin/reports/initialize` additionally requires same-origin checks.
- Every HTTP endpoint authenticates and checks the admin role. Native reporting/setup services independently check the role before database access; fixed native aggregate pipelines intentionally provide administrator-wide operational data. Requests cannot supply Mongo stages/operators or arbitrary projection fields.
- MongoDB is the supported reporting adapter in this release. Other adapters get an explicit unavailable response, not misleading empty reports; existing storefront/legacy dashboard adapter behavior is not replaced.
- Queries use placement-date matching, bounded detail pages/export limits, server-side aggregates, indexed catalog lookups and a 10-second aggregate timeout. Native fixtures larger than previous caps are verified locally; this is not a production load/SLO certification. See MongoDB's [facet behavior and limits](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/) for operational sizing.

## Intentionally deferred

Batch 4 adds first observed confirmation/shipping/delivery dates for newly tracked orders, bounded creation-item snapshots and an app-mediated stock ledger/opening baseline in the separate history view. Historical stock aging/coverage and derived trend reports, full discount/cost/category-name snapshots, payment collection/refund records, cost/profit, courier settlement, background exports and optional GA4 visitor/funnel metrics remain deferred. The older order-specific stock movements and expiring analytics outbox are not substitutes for the new operational history. Do not backfill facts that cannot be proven.

No production deployment, Google account changes, real provider request or production database mutation is part of this batch. Analytics delivery remains in its prior disabled state.

## Verification — 25 October 2026

- Unit/integration suite (`vitest.config.mts`): **409 passed**, including 55 new reporting/calendar/CSV/access tests. Invalid/duplicate filters, leap days, Karachi midnight, zero denominators, formula-safe exports, private columns, audit failure and old-dashboard metric alignment are covered.
- Real local MongoDB replica-set suite (`vitest.commerce.config.mts`): **37 passed** in the explicitly disposable `nski_commerce_test_20261024` database. New reports reconcile 503 orders across pages and exports, 610 variants beyond the old product cap, multi-line products, zero-order/deleted products, payment/status/city/courier filters and 5,001-row export refusal. Existing checkout, stock, email/analytics outbox and transaction tests also pass; provider calls are mocked.
- Isolated Chromium suite (`playwright.images.config.ts`): **33 passed**, including six reporting UX/empty/error/export tests and existing image/video/cart/checkout regressions. Requests use synthetic/intercepted responses. The mobile reporting screenshot was visually inspected.
- Restored local production-build smoke (`playwright.qa.config.ts`, QA-01/02/03/04/08/09/10/14/17/18/19/20, list reporter): **12 passed**. Actual Payload Reports navigation, overview/product/inventory views, guest/customer denial and filtered private CSV exports pass alongside catalog/404/cart/login regressions. The actual admin reporting screenshot was visually inspected. No new working-database orders were created by this smoke subset; setup adds only reporting indexes/readiness and export-audit records.
- **491 passing tests** across those four executed layers. TypeScript, targeted new/changed reporting lint, whitespace diff checks and the final production webpack build passed. The build emitted warnings; repository-wide pre-existing lint debt and a production performance/load certification are outside this batch.
- The restored baseline retains **0 orders** and its **16 original products match** the working copy. Original backup and historical QA JSON evidence were not overwritten. Temporary task-specific QA containers were stopped afterward, retaining their local data.
- No production writes/deployment, live GA ingestion, real payments or email sends were performed. Historical/payment/GA-dependent reporting remains intentionally unavailable as described above.
