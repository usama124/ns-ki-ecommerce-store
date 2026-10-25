# Server analytics — batch 2

Implemented locally on 25 October 2026. Delivery remains disabled. No live Google request, production mutation or deployment was made during implementation.

## What is measured

- `order_placed`: a newly committed checkout order, including transfers awaiting verification.
- `purchase`: the first eligible entry into `confirmed` or `processing`. COD qualifies on acceptance, not cash collection. Transfers qualify after an operator confirms them.
- `transaction_id`: immutable database order ID. `value`: sum of server-accepted unit prices × quantities, in PKR. Shipping and COD fees are separate parameters, not included in merchandise value.
- Payment labels distinguish `cod_due`, `transfer_pending` and `transfer_confirmed`. Confirmation is an operational status, not a payment-provider settlement assertion.
- Each order/milestone has one immutable queue key. Checkout retries, status-only edits, cancellation/reconfirmation and thank-you page reloads do not generate another purchase. Cancellation does not retract a previous purchase; refunds/net revenue need a separate audited workflow.
- Only orders created with valid consented GA context are eligible. No retrospective events for legacy orders, admin-created orders, anonymous/denied analytics, blocked GA identifiers or orders created while the feature was off. Do not fill missing analytics with invented users.

Eligibility is the first confirmation **observed while capture is enabled**. Transitions during a disabled interval are not reconstructed; re-enabling around in-flight orders can omit a milestone or observe a later reconfirmation instead. Do not treat this queue as a full status-history ledger. For a temporary delivery pause, keep capture configured and pause the scheduler; the event age cutoff still applies. Permanent operational milestone history belongs in the next reporting batch.

Order, stock, email outbox, analytics context and analytics event writes share the same MongoDB transaction. Disabled server analytics performs no additional order-hook database work. Optional analytics storage is initialized separately from mandatory commerce storage. While enabled and initialized, a failed analytics write rolls back the transaction rather than silently dropping a financial milestone; the customer can retry the same checkout key. Missing/uninitialized analytics configuration skips capture; monitor readiness before enabling.

## Production configuration — leave off until reviewed

Placeholders exist in `.env` and `.env.example`:

```dotenv
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_GA4_ID=G-PRKY09PGEB
ANALYTICS_SERVER_ENABLED=false
ANALYTICS_DELIVERY_MODE=validate
GA4_API_SECRET=
ANALYTICS_WORKER_SECRET=
```

Never prefix secrets with `NEXT_PUBLIC_`. Production also requires the exact canonical HTTPS `NEXT_PUBLIC_SERVER_URL`. Runtime must be production and Vercel previews remain excluded. Public configuration is compiled: rebuild after changing it.

1. Complete the consent/privacy and Enhanced Measurement checklist in [analytics-setup.md](analytics-setup.md). Agree that `purchase` means accepted merchandise value, not collected revenue.
2. Use a separate test GA4 property and an isolated production-mode staging deployment with its own canonical HTTPS origin. Normal Vercel preview deployments deliberately cannot send. Do not test using production customer orders or production GA credentials.
3. Create the Measurement Protocol API secret in the **matching GA4 web data stream**: Admin → Data streams → web stream → Measurement Protocol API secrets → Create. Put it in server-only `GA4_API_SECRET`. Generate a separate random worker bearer of at least 32 characters; put it in `ANALYTICS_WORKER_SECRET`. Do not send either secret in chat or URLs to your app.
4. Sign in as an administrator and issue same-origin `POST /api/admin/analytics/initialize` once. This idempotently creates private native collections/indexes; there is no public Payload collection exposing identifiers. It does not modify products, orders or commerce readiness. Repeat only after deliberate storage maintenance/migration.
5. Enable browser and server flags on staging; keep delivery mode `validate`. Create fresh synthetic COD and transfer orders after accepting analytics. Test denial/withdrawal, blocked Google, duplicate requests, transfer verification and cancellation/reconfirmation.
6. As admin, use `POST /api/admin/analytics/dispatch`, or schedule `GET /api/admin/analytics/dispatch` with an `Authorization: Bearer <worker-secret>` header. Manual dispatch requires admin authentication and same-origin checks; a customer account is insufficient. There is no automatically installed scheduler.
7. `GET /api/admin/analytics` (admin only) returns readiness, enabled flag and aggregate state counts, never client IDs, tokens, order details or provider secrets. Investigate `review` and backlog. A dispatch processes at most three jobs with 8-second network timeouts and 60-second leases; schedule frequency/capacity must fit volume and the age cutoff.
8. Validate mode sends only to Google's `/debug/mp/collect` and requires an empty `validationMessages` array. It does **not** populate reports or verify the secret/property ownership. `validated` jobs are terminal and never automatically promoted/replayed into collection. Use fresh test orders after switching to `collect`; verify actual GA reports and transaction IDs before enabling production collection.
9. Configure the production property's own secret, canonical domain and scheduler only after client acceptance. Enable production explicitly. Keep monitoring aggregate queue state and reconcile with **consented eligible** orders, not all orders. No GTM container is required; do not install a second loader.

## Delivery semantics and limitations

- Pending jobs are durably leased. A worker crash releases the lease by time, but a second claim is quarantined as `review` instead of blindly resending a possibly accepted request. Timeouts, non-2xx responses and invalid validation responses also require review. There is no exactly-once or guaranteed-ingestion claim and no automatic retry after an ambiguous network send. Stable purchase transaction IDs are an additional downstream deduplication measure, not a substitute for this policy.
- `accepted` means the collection endpoint returned HTTP success, **not** that GA ingested the event. `validated` means validation passed, **not** a recorded conversion. Provider response bodies/errors are not logged or returned to customers.
- Events older than 70 hours are suppressed before sending, preserving their original timestamps rather than restamping them as new conversions. A shopping session ID is attached only when both capture and its timestamp-shaped session start are less than 24 hours old; later confirmations and non-timestamp session IDs omit it. No fake engagement duration is added, so Realtime/session attribution completeness is not promised.
- Contexts expire after three days; later transfer confirmations are not exported. Native outbox records expire after 30 days; revoked-capability hashes after 180 days. MongoDB TTL deletion is asynchronous; context eligibility checks expiry immediately. Historical operational totals belong in admin reporting, not in a GA backfill with invented timestamps.
- Browser withdrawal immediately stops browser events and sends the random capability to a same-origin, rate-limited endpoint. The backend stores only its hash, suppresses queued events and removes that grant's stored context. Failed offline withdrawals are retained locally and retried on later navigation/visits; new server grants wait until the old withdrawal is acknowledged. Already-sent/in-flight requests cannot be recalled. Clearing local storage, changing devices or never reconnecting can prevent withdrawal delivery. A separate data-deletion process is required for previously ingested data; this basic preference control is not a certified CMP or a compliance guarantee.
- A consent snapshot supplied at checkout is not independently proven identity or consent attestation. GA IDs are pseudonymous identifiers, not customer account IDs. No email/name/phone/address, bank reference, receipt URL, raw page URL/referrer or free-form customer data is included.
- Queue counts are operational diagnostics, not the full admin Reports feature. UTM policy, GA funnels/dashboards, stock/order/product reports, safe exports and explicit payment collection/refund states remain next batches.

Official references: [Measurement Protocol transport and consent](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference), [event validation and its limitations](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events), [event timing](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events).

## Local verification — 25 October 2026

- Unit/integration suite: **354 passed** (`vitest.config.mts`). Includes context allowlisting, money/privacy boundaries, opt-in, bounded GA callbacks, SSR, access control and scheduler authorization.
- Real MongoDB replica-set suite: **30 passed** (`vitest.commerce.config.mts`, explicitly disposable `nski_commerce_test_20261024`). Covers transactional rollback, concurrent checkout retries, confirmation deduplication, transfers, concurrent worker leases, validation/collection modes, rejection/timeout quarantine, consent withdrawal, expiry and missing configuration. Every provider request is mocked.
- Isolated Chromium suite: **27 passed** (`playwright.images.config.ts`), including real consent/capture/withdrawal interaction, plus image/video/cart/checkout regressions. Google requests are intercepted.
- Local production-build smoke: **9 passed** (`playwright.qa.config.ts`, QA-01/02/03/04/08/09/10/14/17, list reporter). Catalog, terminating 404s, API access, repricing, mobile/desktop product UI, cart persistence/corruption, safe login and existing admin pagination/scope all passed. No new working-database orders were created by this smoke subset; the complete QA suite was not rerun or counted.
- **420 passing tests** across those four executed layers. TypeScript, targeted analytics/backend lint, production webpack build and whitespace diff checks passed. The build emitted warnings; this was not a repository-wide lint cleanup.
- Native test mutations were confined to the disposable test database. The restored baseline still has **0 orders** and its **16 original products match** the working copy. Original backup and historical QA JSON evidence were not overwritten.
- No real analytics ingestion, payment, email, deployment or production database mutation was tested or performed. Temporary QA services were stopped after verification, with their data retained. Real property validation and client/privacy approval remain rollout gates.
