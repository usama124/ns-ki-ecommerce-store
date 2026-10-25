# Historical operations — batch 4

Implemented locally on 25 October 2026. In **Reports**, expand **Order history, first milestones & stock ledger**. Tracking is disabled until an administrator explicitly enables it. This batch does not deploy or activate production tracking.

## What is recorded

- Order changes, deletion events and immutable creation-item snapshots: product/title, primary category ID, SKU/variant ID when resolved, size, quantity and accepted unit price. Customer/contact/address, receipt, payment reference and notes are excluded.
- First observed confirmation/processing, shipping and delivery timestamps for orders created after activation. First values are retained through cancellation, reopening, renaming and deletion. These are application-observed dates, not independently verified courier scans or bank settlement dates. A later status does not invent earlier milestones.
- Transactional inventory movements across checkout allocation, cancellation/restoration, inventory updates, direct Payload product edits, variant removal and product deletion. Stable product/variant IDs, before/after stock, delta, reason, actor and linked order are retained. Concurrent updates and transaction rollback are covered.
- Opening stock observations at each variant's actual baseline time. Opening rows have `delta=0`; reconcile their `after` balance plus subsequent deltas, not deltas alone. Removed variants are retired rather than silently reusing their identity. Retirement is a tracked catalog-stock change, not evidence of physical disposal.

Order allocation snapshots distinguish requested, deducted and backordered units. They are active snapshots repeated across history events, **not additive demand records**. The older order-specific commerce movement collection remains unchanged; do not sum it with this ledger.

Inventory updates now send stable variant IDs and expected stock from the admin screen; stale edits receive a conflict rather than overwriting newer stock. Legacy API callers without these optional fields remain supported. Reasons supported by the update endpoint are restock, damage, correction and manual_adjustment.

## Controlled activation

1. Take the usual database backup and release the tested code. No new environment variables, Payload fields, generated types or import-map changes are required by this batch. Transaction-enabled MongoDB and prepared commerce infrastructure are prerequisites.
2. Schedule a controlled cutover: drain/pause in-flight commerce/catalog writes while enabling history. A request that started before activation must not be treated as fully tracked merely because it finishes afterward.
3. As an administrator, open the history section and click **Enable operations history**. Same-origin `POST /api/admin/operations/initialize` creates private native collections/indexes and an activation marker. Reads never perform this setup implicitly. Review index creation under the normal production change process.
4. Click **Capture next 25 product baselines** until the batch completes. Keep the section open to retain its cursor; restarting from the beginning is safe and does not reset existing baselines. New catalog/stock writes also capture a missing baseline transactionally. Capture uses a temporary transactional write fence to serialize against concurrent writes without changing saved product contents/timestamps.
5. Check current/tracked variant counts and drift count. Investigate any invalid/missing stable variant IDs or stock values before proceeding. A global activation timestamp does not mean every old variant was observed at that exact time.
6. Verify authorized test-order transitions and stock reconciliation through the normal staging workflow before allowing production changes. Monitor query times and database load with the client's actual volume; local tests are not a production performance certification.

Direct database writes bypass application hooks. When the recorded balance differs from product stock, subsequent app stock mutations fail closed with a reconciliation error. **Do not disable tracking, delete ledger rows or reset baselines to bypass drift.** Stop affected writes, investigate and agree a separately reviewed repair. A dedicated drift-repair workflow is not implemented yet.

## Reading and exporting history

Choose order changes, stock movements or first milestones, Karachi calendar dates and an optional matching record ID. Click **Load history**. Date windows are 1–366 days; details use deterministic 50-row pages. Exports/pagination use the applied filters, not unsaved form edits.

- Order/stock dates mean **event recorded date**, not order placement date. Order-event counts are not distinct order counts.
- Milestones use the selected first-confirmed/shipped/delivered date. First-confirmed value is historical accepted order value, including stored fees, retained after cancellation; it is not collected cash, net revenue or a refund-adjusted amount.
- Orders predating activation have partial legacy coverage if subsequently changed. No old transitions, first dates, payments or stock movements are fabricated. Legacy orders do not enter complete first-milestone reports.
- An order-ID-filtered JSON view includes bounded item snapshots. CSV intentionally excludes item arrays and all customer/payment-proof fields.
- CSV exports include all matches up to 5,000 rows; larger requests fail with HTTP 413 rather than truncating. Formula-like values are neutralized. Each export must persist a minimal administrator/filter/count audit before returning; audit records expire after 90 days via MongoDB TTL cleanup.

All history/setup/status/baseline/export endpoints require admin access; mutations also require same-origin checks. Native services independently enforce the role. Responses are private/no-store. Requests cannot supply database pipelines or arbitrary fields. Database aggregates have a 10-second timeout. Source history/ledger records are append-only through the application after transaction commit; derived balances/milestones update transactionally. These private native collections have no generic editing/deletion API. Durable history has no automatic expiry; agree retention/access policy for order and actor identifiers with the client.

Implementation: `src/utilities/operationsHistory.ts`, `src/lib/reports/operations.ts`, `src/app/api/admin/operations/` and `src/components/admin/ReportsView/OperationsPanel.tsx`.

## Still pending

Explicit payment collection and partial refund records/workflows; courier settlement; cost/profit; historical stock aging/coverage and derived trend dashboards; background exports; complete category-name/discount/COGS snapshots; optional GA4 admin metrics and real analytics activation/ingestion validation. No money is moved and no analytics refund event is inferred from a cancellation. Existing cohort reports retain their original definitions; this history view does not silently replace them.

## Verification

Executed against the final local source/build:

- **436** unit/integration tests: filters/roundtrips, role gates, endpoint security, stale inventory checks and existing regressions.
- **50** real disposable MongoDB replica-set tests: transaction rollback, checkout replay/backorders, concurrent stock writers, baseline pagination/racing checkout, drift detection, immutable first milestones/creation snapshots, deletion retention and full-match audited exports.
- **36** isolated Chromium tests: history setup/cursor, applied-filter pagination/export, failure states and escaped snapshots, plus existing media/cart/checkout/reporting regressions. External requests are intercepted.
- **14** restored production-build smoke tests: actual Payload Reports screen/setup/baselines, guest/customer denial and prior catalog/404/cart/login/report regressions. Screenshot visually inspected.
- **536 tests passed** across these four layers. TypeScript, targeted new operations lint and production webpack build passed; build warnings and unrelated repository lint debt remain. No production load/SLO claim is made.
- The pristine restored baseline retains **0 orders**; all **16 original products** remain byte-equivalent to their working-copy counterparts after smoke testing. Baseline capture changed no original product data. The original backup and historical QA JSON were not overwritten. Only isolated working/disposable databases received fixtures/setup records; no production write, deployment, real Google ingestion, email send or payment occurred.
