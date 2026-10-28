# Approved QA remediation — verification

24 October 2026 · changes are local and not deployed

The user approved remediation following the initial audit. Original audit evidence is retained in `test-artifacts/restored-browser-results.json`; final revalidation is separate in [remediation-browser-results.json](test-artifacts/remediation-browser-results.json).

## Implemented changes

- **QA-B01, order financial consistency:** subtotal and total are derived from accepted line-price and shipping-fee snapshots, before validation and again before inventory writes in the existing transaction. Invalid/fractional/negative/overflow values are rejected. Administrator-created orders do not need manual derived totals; subtotal/total are read-only in the admin form. Item edits reconcile money and stock atomically. No silent repricing from today's catalog, no automatic payment capture/refund, and no rewrite of existing order records.
- **QA-B02, COD notifications:** COD confirmations say order confirmed and amount due on delivery, not paid/verified. Digital confirmed-payment wording remains. Previously queued email HTML is not rewritten; review any pre-existing misleading queued messages separately before dispatch.
- **QA-B03, reporting limits:** orders have bounded 50-row pages and database-side search/status filters, with full-history Mongo aggregation for summary cards. A bounded, access-controlled fallback handles other configured adapters. The value card is explicitly not collected cash. Inventory exposes product pages rather than silently stopping at product 300; categories are no longer capped at 100. Inventory counters/search/stock filters are explicitly **current-page scope**, not global analytics. Unsaved stock edits block page changes. Stale report responses are ignored. This is not a new finance/settlement or full analytics/report-export module.
- **QA-B04, checkout accessibility:** delivery fields and digital reference input have associated labels/IDs and address/contact autocomplete; server errors use an alert role. Chromium assertions verify delivery-field accessible names. Formal screen-reader/contrast certification remains outside this run.
- **QA-B05, cart resilience:** persisted carts are schema-checked, invalid rows/top-level data recover safely, counts and money are bounded, and storage removal failures cannot break checkout completion. Legacy cart key is removed on successful clearing. No cross-device/account cart feature added.
- **QA-B06, redirect security:** login and signup use a shared local-path validator, rejecting external/protocol-relative/backslash/control-character targets. Safe order paths and token queries are preserved. Full-browser login verifies a malicious external target falls back to `/account` without an external request. No XSS claim.
- **QA-R05, browser checkout Origin:** verification now trusts the configured public store origin instead of Next's internal bind hostname. Untrusted origins, spoofed forwarded headers and cross-site requests are still rejected. Invalid configured origins fail closed. No authentication/access control was disabled.
- Unit-test setup no longer imports production/developer `.env`; tests use explicit dummy local configuration.

## Verification performed

- **305 Vitest tests passed**, 30 files (business logic, access, input validation, report boundaries and new remediation cases).
- **18 real Mongo replica-set tests passed**, separate disposable synthetic database. Includes a 501-order aggregation/page boundary, order create without manual derived totals, quantity-edit totals and inventory, rejected-edit rollback, concurrency/idempotency/cancellation/outbox regression.
- **23 isolated Chromium component tests passed**, including image optimization/responsive media, checkout retry/receipt behavior, video/reel and responsive-layout regressions.
- **22 full restored-app HTTP/Chromium tests passed** against the final isolated production build. Includes all four manual payment-method checkouts on mobile, confirmation and cart clearing; ownership/receipt fail-closed boundaries; corrupt-cart recovery; safe login; totals; accessible labels; administrator report navigation and visible inventory scope.
- **Total: 368 test cases passed; zero failed** in the final runs. These are mixed test layers, not 368 full end-to-end journeys.
- Production webpack build and TypeScript: PASS. `git diff --check`: PASS.
- Repository-wide ESLint still reports **30 errors / 253 warnings**; existing unrelated lint debt is not represented as fixed. Targeted financial/report/cart/redirect/security utilities have no lint errors.

## Safety and data handling

Only the working restore and disposable transaction-test DB were mutated, with synthetic users/products/orders and test configuration. Original restored product records remain unchanged; baseline orders remain zero. No real customer login, live order, payment, email or receipt was used. Outbound app networking and non-local browser requests remained blocked. Original backup and production `.env` were not modified. QA services are stopped after verification; local task containers/data are retained rather than deleted.

## Deployment and outstanding prerequisites

1. Deploy the code through the normal release workflow; this task did not deploy or modify production data.
2. Set `NEXT_PUBLIC_SERVER_URL` to the exact canonical public origin customers use, including HTTPS; align redirects for apex/www and configure preview/staging deployments with their own correct origin. Do not use the internal container hostname. No new secret variable is required.
3. Ensure existing commerce initialization and private R2/email configuration are present. No schema/type shape changed, so no new migration is introduced by these fixes. Existing commerce readiness is still required.
4. Verify real private-bucket upload/customer/admin view, bucket privacy/CORS, email inbox delivery, password reset, scheduler/outbox monitoring and deployed analytics in an authorized sandbox/staging environment. These remain BLOCKED/unverified, not passed by local mocks.
5. Full saved-address management, lifecycle transition policy, settlement/refunds, cross-device/long-lived cart policy and global inventory analytics/search require separate requirements; not silently implemented here.
6. Existing inconsistent historical totals or pre-rendered outbox email bodies are not automatically repaired. Review/approve any production data remediation separately if such records exist.

Release assessment: **ready for the locally tested remediation scope**, not an unconditional whole-store production sign-off. The original NOT READY audit remains historical evidence; external operational prerequisites and broader untested scenarios still apply.
