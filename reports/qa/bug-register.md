# QA defect register — 24 October 2026

Baseline `fd4210f`. Initial findings below are preserved for traceability. The user subsequently approved fixes: **QA-B01–B06 are implemented and locally verified**; see [remediation verification](remediation-verification.md). Original OPEN status lines describe the initial audit, not current implementation status. External service/deployment prerequisites remain unverified.

## QA-B01 — Editing order quantities leaves financial totals stale

- Severity: **P1**, confirmed by full local HTTP integration against restored working MongoDB.
- Feature/environment: administrator order editing, isolated Next/Payload app; synthetic orders only.
- Preconditions: initialized commerce schema, synthetic administrator, published item priced at Rs. 1,000; Lahore shipping Rs. 250 and COD fee Rs. 100.
- Reproduction: create a COD order for one QA-M item through `POST /api/orders`; authenticate the synthetic administrator; PATCH `/api/orders/{id}` with the same product/size, quantity 3 and unitPrice 1000; GET the updated order.
- Expected: either reject unsupported financial edits, or consistently recalculate subtotal and total under the chosen pricing policy. Three items plus unchanged fees total Rs. 3,350.
- Actual: PATCH succeeds; quantity becomes 3, but totalAmount stays Rs. 1,350. Inventory reconciliation is present, so money and fulfillment quantities diverge.
- Evidence: automated case QA-07; expected 3350, received 1350 on repeated executions.
- Code: `src/collections/Orders.ts` beforeChange reconciles inventory but does not recalculate financial fields. Financial fields are independently editable.
- Business impact: undercharging, inaccurate revenue, incorrect order/customer records.
- Recommended fix: define immutable accepted-price snapshots versus explicit administrator repricing; recompute derived amounts atomically or reject item edits until an explicit requote/confirmation workflow exists. Never trust arbitrary submitted totals.
- Regression: quantity/variant/item removal/price changes, sale and shipping threshold changes, cancellation/reactivation, invalid amount edits, concurrent edits and rollback. Preserve checkout idempotency tests.
- Status: OPEN; fix requires approval.

## QA-B02 — COD confirmation claims payment was verified/paid

- Severity: **P2**, code-confirmed and corroborated by queued synthetic outbox records; inbox delivery intentionally not tested.
- Feature/environment: COD customer confirmation emails, isolated working database with no email transport.
- Preconditions: COD checkout creates an initially confirmed order with a synthetic customer email.
- Reproduction: create that order; follow `enqueueOrderEmails` selection for `confirmed`; render `getPaymentConfirmedCustomerEmailHtml` with paymentMethod `cod`.
- Expected: order confirmed, payment due on delivery; no statement that payment was received.
- Actual: template says `PAYMENT VERIFIED`, “Your payment ... has been verified,” and `Total Paid`. Aggregate working-copy inspection found five queued confirmed messages containing the verified badge after the first two integration runs. No messages were sent.
- Evidence: `src/utilities/orderOutbox.ts` create/status selection and `src/utilities/emailTemplates.ts` confirmed template; QA-15 encodes the correct expected behavior.
- Business impact: customers may believe a COD balance has already been paid; support/payment disputes.
- Recommended fix: separate COD order confirmation from digital payment verification, and distinguish amount due from amount paid.
- Regression: all four payment methods, create versus status transitions, cancellation/reactivation, and template content assertions.
- Status: OPEN; fix requires approval.

## QA-B03 — Admin reporting silently truncates historical orders/inventory

- Severity: **P2**, code-confirmed boundary defect; not a failure observed in the small restored catalog.
- Feature/environment: reporting APIs, repository inspection.
- Preconditions: more than 500 orders or 300 products; inventory category selector also caps categories at 100.
- Reproduction: inspect `/api/admin/orders`, which loads latest 500 orders and computes totals/search/status counts only from that array; inspect `/api/inventory`, which loads 300 products/100 categories without pagination traversal.
- Expected: metrics clearly identify a date range/page or aggregate the requested full dataset; all inventory can be reached.
- Actual: older orders cannot be searched and do not contribute to displayed totals. Inventory reports `totalProducts` from totalDocs while returning variants for only the first page.
- Evidence/code: `src/app/api/admin/orders/route.ts` limit 500 and array-derived metrics/filtering; `src/app/api/inventory/route.ts` limits 300/100.
- Business impact: silently incorrect reports and inaccessible inventory as the store grows.
- Recommended fix: DB-side filtered pagination and aggregate metrics over the same explicit range; index filters; distinguish gross order value from collected cash/revenue.
- Regression: datasets at 499/500/501 orders and 299/300/301 products; search for oldest record; totals versus DB aggregation.
- Status: OPEN, code-confirmed. Large-fixture runtime verification NOT TESTED.

## QA-B04 — Checkout labels lack programmatic associations

- Severity: **P2**, code-confirmed accessibility defect; formal assistive-technology testing not performed.
- Feature/environment: checkout delivery form, repository inspection.
- Preconditions: checkout with a nonempty cart.
- Reproduction: inspect Full Name, Phone, Email, City, Province and Street Address labels/controls in `src/components/checkout/CheckoutPage.tsx`.
- Expected: each label associates with a control using htmlFor/id or nesting; errors are announced and identifiable.
- Actual: visible sibling labels lack htmlFor and controls lack matching id; placeholders are not a replacement for accessible names.
- Business impact: screen-reader/voice navigation cannot reliably identify required delivery fields.
- Recommended fix: stable IDs/label associations, autocomplete attributes and accessible validation/error announcements; test keyboard focus and screen-reader names.
- Regression: `getByRole`/`getByLabel` accessible-name assertions for every delivery field and validation error.
- Status: OPEN, code-confirmed; accessibility tree and human screen-reader review pending.

## QA-B05 — Malformed persisted cart crashes storefront

- Severity: **P2**, confirmed in Chromium against the isolated production build.
- Preconditions/reproduction: set localStorage `nski_cart` to `{}` before opening the homepage; allow JavaScript hydration.
- Expected: discard invalid storage and recover an empty cart without breaking navigation.
- Actual: browser raises `t.reduce is not a function` and client rendering fails.
- Evidence: QA-09. Earlier SSR-only development passes were inconclusive and superseded.
- Code: `src/providers/Cart/index.tsx` loadCart JSON.parse and unconditional items.reduce.
- Impact: affected visitors cannot use the store until corrupt storage is cleared; no remote attack demonstrated.
- Recommendation: validate array/item schema, finite quantities/prices and migrations; recover safely; handle unavailable storage in clearCart.
- Regression: objects/null/strings, malformed JSON, invalid items, blocked storage, legacy keys and normal persistent cart.
- Status: OPEN; no fix applied.

## QA-B06 — Login accepts external post-authentication redirects

- Severity: **P2**, confirmed open redirect in production-build Chromium; no XSS claim.
- Preconditions/reproduction: open `/login?redirect=https%3A%2F%2Fqa-external.invalid%2F`; enter valid synthetic credentials and submit Continue.
- Expected: reject external target and navigate only to an approved same-origin path.
- Actual: after successful authentication, browser attempts `https://qa-external.invalid`; QA interception aborts before any external visit.
- Evidence: QA-14. No password or token sent externally.
- Code: `src/components/forms/LoginForm/index.tsx` router.push(redirect.current). CreateAccountForm has analogous unchecked logic, reviewed but not independently executed.
- Impact: trusted login links can send customers to attacker-selected destinations and facilitate phishing.
- Recommendation: allow only validated local paths, reject external/protocol-relative/script schemes and use a safe fallback.
- Regression: external/encoded/protocol-relative targets versus approved account/order paths; do not leak guest tokens.
- Status: OPEN; no fix applied.

## Findings requiring verification or business decisions (not confirmed vulnerabilities)

- QA-R01: Login external redirect is confirmed as QA-B06. CreateAccount redirect and script-scheme execution need independent verification; no XSS demonstrated.
- QA-R02: Invalid-object cart crash is confirmed as QA-B05. Blocked storage, expiry, account merge and cross-tab synchronization remain policy/test gaps. No cross-device feature found.
- QA-R03: Status endpoint accepts any supported enum rather than a transition graph. Delivered-to-pending or reactivation requirements need business approval; do not invent forbidden transitions. COD confirmed does not mean collected/paid. No standalone payment ledger/refund flow was found.
- QA-R04: `/account/addresses` renders components that return null. Saved-address management is partially implemented, not a demonstrated regression. Clarify whether it is in launch scope.
- QA-R05: Local proxy/dev-server Origin mismatch causes browser-like requests with an Origin header to receive 403. CLI requests without Origin exercise business commands. Verify same-origin behavior in a production-shaped staging deployment before release; do not assume the live store has this failure.
- QA-R06: Restored baseline has no commerce readiness marker/native transactional collections. Explicit `commerce:initialize` is a deployment prerequisite, not legacy-order migration. Backup contains zero orders.

## Maintainability/coverage

P4: lint currently fails with 31 errors and 265 warnings. Existing legacy E2E config loads dotenv, can reuse an unknown localhost server, and contains obsolete template routes/payment assumptions; it is unsuitable for this restored-data audit unchanged. No CI configuration was found under `.github/`. Monitor outbox retries/dead jobs, commerce readiness, API failures and stock reconciliation; no operational guarantees were measured.
