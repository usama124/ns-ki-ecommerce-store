# Historical trends and stock inactivity

Implemented locally on 25 October 2026. Open **Reports → Historical trends & stock inactivity**. This adds read-only derived reports over the existing milestone, inventory and actual-money records. No production activation, source backfill or Google configuration is performed.

## Setup

1. Use the normal backup/staging/release workflow. There are no new environment variables, Payload schema fields, generated types, import-map entries or packages in this batch.
2. As an administrator, expand the section and click **Prepare insight indexes & exports** once. Same-origin `POST /api/admin/insights/initialize` creates the compound variant/date ledger index, first milestone date indexes, money occurrence index, private export audit/TTL index and an `insights-v1` readiness marker. Repeating setup is safe. Review index creation for production database size under the normal change process.
3. Setup may create empty private native source collections while preparing indexes. It does **not** enable history/money recording, create old facts, capture baselines, change stock/orders or send analytics. Source activation remains separate: [historical operations](historical-operations.md), [payment recording](payment-recording.md).
4. Choose daily trends or stock insights, inclusive Karachi dates and, optionally for stock, a database product ID. Click **Load insights**. Windows are 1–366 calendar days, ending no later than today. Queries are not triggered on every filter keystroke.

## Daily operational trends

- First confirmation/processing count and historical accepted value, first shipped count and first delivered count use their respective observed **first milestone dates**, not placement dates or `updatedAt`. Only orders tracked since creation qualify. Later cancellation, reopening or deletion does not erase or repeat a first milestone.
- Pre-tracking days are **unavailable**, not zero. The activation day and current day are marked partial. Subsequent zero-filled days mean no qualifying tracked-new-order milestone, not proof that no legacy order was processed. Skipped transitions are not invented; a delivered order need not have an observed first-shipped date.
- Accepted value includes stored fees and is not cash collected or refund-adjusted revenue.
- Collections, refunds and net recorded money movement use **actual money occurrence dates** from explicitly entered records. They can include proven backdated entries before recording was enabled. Zero means no matching recorded event, not complete historical cash coverage. If money recording is not enabled, values are unavailable rather than zero. Current-day future-skew entries are excluded until their stated occurrence time.
- Money totals are summed in integer minor units before converting to PKR, avoiding decimal accumulation artifacts. A refund of an earlier collection can make a period's net movement negative. Late entries can revise earlier periods.
- These are independent activity series, **not a placement cohort or conversion funnel**. Do not divide today's deliveries by today's confirmations to report a conversion rate; they can represent different orders. GA4 visitor/cart attribution is not part of this report.

Totals span all selected days, independent of the deterministic 50-day detail pages. Missing metrics remain null/unavailable in JSON, UI and CSV (empty cells). Default range is the last 30 Karachi days.

## Stock inactivity, historical balances and allocation coverage

Scope is **current catalog variants**, including drafts, with current product title/SKU and stable product/variant IDs. Retired/deleted variants are deliberately not reconstructed as a historic catalog. Consequently, these totals are not a store-wide historical stock movement total including deleted catalog records; use the raw stock history for those events.

- **Current stock** is the current product balance. A matching active ledger balance and valid baseline are required before derived inactivity/balance/coverage is trusted. Drift or an untracked variant is explicitly labeled. Drift must be investigated, not bypassed by resetting balances.
- **Opening stock** is the last recorded `after` balance before the selected start, provided the baseline was captured by that start. An opening baseline exactly at the boundary is accepted, but an allocation at that same instant belongs to period movement, not opening stock.
- **Closing stock** is the last recorded `after` balance before the selected end-exclusive cutoff (or request time, if today). It is unavailable if that variant had not yet been observed. These are known ledger balances, not a reconstruction of pre-baseline stock.
- **Recorded net change**, gross physical allocation units and physical restored units describe ledger events within the selected window. Opening observations have zero movement and are excluded. Partially covered windows retain their observed movements but are not presented as complete demand.
- A backorder can request more than the physical deduction; only the deduction is counted here. Cancellation/reopening can cause repeated physical allocations/restorations, so gross allocation units are **not distinct ordered units, delivered sales or net demand**.
- **Observed inactivity days** is the floored elapsed time since the last recorded stock change, falling back to the baseline observation when no change exists. The summary counts positive-stock variants unchanged for at least 30 days. A restock or correction resets observed inactivity; it does not prove every remaining unit is new.
- **Allocation coverage estimate (days)** is current stock divided by gross recorded physical allocations per elapsed day in the selected reference window. The denominator uses elapsed time through request time for the current partial day, or the full elapsed window for a past end date. It uses current stock even when the reference demand window is historical. Partial-window, untracked/drifted and zero-allocation cases are unavailable, not infinite coverage. Zero current stock with positive known allocations can legitimately produce zero coverage.

This estimate is not a forecast or a recommendation to buy inventory. It ignores unfulfilled backorder demand, seasonality and future campaigns. Full-window eligibility assumes uninterrupted application-mediated tracking; native database changes and deliberate disabling of tracking are outside that guarantee. No pre-baseline movements, FIFO layers, costs or receipt lots are inferred.

**Physical unit aging and true sell-through remain unavailable** without stock receipt/lot and appropriate demand/return facts. Do not call inactivity “oldest stock age.” This is an intentionally honest first inventory-aging aid, not a substitute for lot accounting.

## Access, exports and performance

All status/read/setup/export HTTP endpoints require an administrator. Native services independently enforce the role. Setup also checks same-origin. Responses are private/no-store; customer/contact/address, receipts, payment references, fingerprints and free-form notes are not returned. Native aggregates are fixed, not browser-supplied database stages.

Stock aggregation uses an indexed per-variant ledger lookup and snapshot read concern for internally consistent current product/balance comparisons. This requires snapshot-capable transaction-enabled MongoDB (locally verified on MongoDB 8). Each aggregate has a 10-second timeout. Daily source series are independent read queries and may observe concurrent commits at different times; generated time is not a promised cross-report accounting lock. Reporting queries run only when this admin section is used; no new storefront query/hook is added.

Detail pages contain 50 rows; summary totals include every matching variant/day. CSV uses applied filters, not unsaved inputs or only the displayed page. Trends export all selected days; stock export supports at most 5,000 matching variants and returns HTTP 413 otherwise. Narrow to a product for larger catalogs. CSV contains a UTF-8 BOM, CRLF rows, formula neutralization and UTC stock timestamps. Money columns are labeled PKR.

Each generated export must persist a minimal actor/filter/count audit in `nski_insight_exports` before returning. Audit failures return an error, not a partial download. The audit expires after 90 days via asynchronous MongoDB TTL and is not proof of receipt by the browser. No new long-lived financial/stock source records are written by these reports. Existing operational source retention policies still apply.

UI: `src/components/admin/ReportsView/InsightsPanel.tsx`. Service: `src/lib/reports/insights.ts`. APIs: `src/app/api/admin/insights/`.

## Remaining work

Receipt/lot capture and physical aging/FIFO; trustworthy sell-through and demand coverage including backorders/returns; courier settlement and bank/cash reconciliation; bookkeeping corrections/credit notes; background exports; GA4 funnels/admin traffic metrics and staged real ingestion validation. No production load/SLO certification is implied by local fixture tests.

## Verification — 25 October 2026

- Unit/integration suite: **495 passed**, including 19 new filter/roundtrip/native role/HTTP access tests. Invalid/future dates, irrelevant IDs, duplicate parameters, non-admin requests, same-origin setup and sanitized errors are covered.
- Real disposable MongoDB replica-set suite: **75 passed**, including 11 new insight tests. Covered: pre-activation nulls, legacy exclusion, retained cancelled/deleted firsts, Karachi midnight, exact decimal sums, negative money periods, known opening/closing stock, partial/drifted/untracked states, no-allocation rates, baseline/first-allocation boundary ties, inactivity observations, 61-variant pagination/formula-safe CSV, 5,001-variant export refusal, all trend days, setup isolation and audit persistence failure. Prior commerce/payment/history/analytics regressions also pass. Only the fixed synthetic `nski_commerce_test_20261024` database is cleaned by that runner.
- Isolated Chromium suite: **44 passed**, including four new insight setup/unavailable/pagination/export/error/mobile tests. All external requests are intercepted. The mobile screenshot was visually inspected.
- Restored local production-build smoke: **18 passed**, QA-01/02/03/04/08/09/10/14/17/18/19/20/21/22/23/24/25/26 with list reporter. Actual admin insights, full stock CSV and guest/customer denial pass alongside earlier catalog/404/cart/login/report/payment checks. The real admin screenshot was visually inspected. The existing payment smoke creates one synthetic order/money fixture only in the local working copy; no actual money changes hands.
- **632 tests passed** across those executed layers. TypeScript, targeted insight lint, whitespace checks and the production webpack build passed. Existing build warnings and unrelated repository lint debt remain. This does not certify production load/SLOs.
- The pristine restored baseline still has **0 orders**; all **16 original products** remain unchanged in the working copy. Original backup and historical QA JSON evidence were not overwritten. Task-specific QA services and the localhost bridge are stopped after verification, retaining local fixture data. No production database mutation/deployment, `.env` change, real Google ingestion, email send or payment occurred.
