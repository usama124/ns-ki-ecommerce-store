# P0 implementation: batch 1

**24 October purchase-integrity update:** The next MongoDB transaction/idempotency, inventory-allocation, order-email outbox and shared rate-limit batch is implemented locally. Read [Commerce reliability rollout](commerce-reliability-rollout.md) before deployment: initialization, legacy-stock reconciliation and an email scheduler are mandatory operational work. The pending list below is the historical first-batch checkpoint, not the latest implementation status. Full production P0 sign-off is still not claimed.

**24 October update:** Private receipt upload/view code and configuration placeholders are now implemented; see [Private order receipt storage](private-order-receipts.md). The temporary screenshot-disable decision below describes the earlier batch checkpoint and is superseded for new private receipts. The bucket still needs its real environment values and staging verification. Historical public receipts are unchanged. Other P0 work remains pending.

23 October 2026. This is a staged implementation, **not completion of the full P0 plan or a production-readiness certificate**. Nothing has been deployed. No production DB, R2, migrations or paid infrastructure were changed. The original audit records the pre-change revision and remains valid as a historical baseline.

## Implemented locally

- `apiSecurity.ts`: shared admin authentication/role guard; explicit `user` + `overrideAccess:false`; same-origin checks on writes; 64 KiB streamed JSON cap even without Content-Length; bounded batch/stock inputs; sanitized dependency errors and private/no-store responses.
- Protected all custom admin orders/status, sale settings, dashboard stats, and inventory read/update handlers. The independent Next.js handlers no longer rely on the admin screen to protect them.
- Generic Payload order creation is admin-only, closing the unauthenticated GraphQL alternate create path. Products use published-only public collection access; preview now checks the authenticated user’s admin role and rejects unsafe redirects.
- Orders have an optional immutable `customerAccount` relationship. New authenticated checkouts set it from the server-authenticated session, never from supplied account IDs or delivery email. History is owner-filtered and limited to 50 recent orders. Existing orders are **not automatically linked by email**. Pagination beyond the first 50 remains a follow-up.
- Order-detail reads enforce owner/admin access or a signed, order-specific seven-day guest link. Checkout confirmation offers this link; the find-order email action signs new links. Raw order IDs and old unsigned guest links no longer grant access. Rotating the Payload secret invalidates outstanding guest links; token-specific revocation is not implemented in this batch.
- Order tracking requires complete exact-match contact/order identifiers, returns only status/date/courier information, and never returns customer addresses, proofs, totals, product documents or internal notes. No rate limiter has been added yet; full-contact matching is not represented as strong authentication, which is why its response is deliberately minimal.
- Payment proofs/internal notes are admin-only fields on owner-readable order APIs. Private routes get no-store, no-referrer and noindex headers. These code-level policies do **not** override an external Cloudflare rule that explicitly forces public caching; staging/provider inspection is still required.
- Checkout validates bounded customer/cart/payment input, normalizes duplicate product/size lines, rejects fractional/oversized quantities, batches published product reads, resolves the exact server variant/SKU, and computes unit prices, active sale prices and shipping/COD fees from current database state. Browser amounts/status/notes/account fields never become authoritative values. Prices are currently whole-number PKR; fractional or invalid configured amounts fail closed.
- A different current grand total returns `409 QUOTE_CHANGED` without creating an order. The browser displays the revised quote and requires another explicit confirmation. Missing totals also require review. This is **not an idempotency/replay mechanism**.
- Configured city fees/thresholds are used by the shipping calculator. Zero variant-price overrides are consistent with nullish overrides rather than silently falling back to base price. Unconfigured/template digital-payment destinations are disabled in UI and rejected server-side; presence checks do not independently verify a merchant’s bank account.
- Final stock hooks additionally reject invalid quantities, unavailable/unpublished products and unmatched sizes rather than silently skipping deduction. **The existing read/replace transaction/concurrency design is not yet replaced.**

## Receipt safety decision

The owner confirmed that no private receipt bucket exists. Until that infrastructure is set up:

- Anonymous/customer catalog media creation and direct R2 upload signing are disabled; administrative product/media uploads remain available.
- Checkout screenshot/file input and the public `/api/media` receipt upload request are removed. Digital orders require a valid transaction reference; COD is unchanged. The server rejects screenshot submissions, including forged legacy media IDs. The old admin order screenshot field is read-only; existing proofs remain viewable by admins, without allowing new uploads through that field.
- The UI explains why screenshots are temporarily unavailable. Do not re-enable uploads to the public product bucket.
- Known legacy receipt metadata marked `Payment proof from ...` is excluded from anonymous media access. This is a limited mitigation, **not a guarantee that all historical receipts are private**. Old R2 object URLs, alternate metadata, browser caches and CDN caches are unchanged and may remain public.

Next storage step: the owner creates a separate R2 bucket with public/r2.dev/custom-domain exposure disabled, scopes storage credentials appropriately, and supplies its non-secret bucket identifier through the approved configuration workflow. Do not paste credentials into chat. The next implementation must add private receipt ownership/capabilities, byte/MIME/pixel limits, authenticated short-lived downloads and orphan cleanup. Before restoring uploads, verify the bucket is actually private; a `private/` prefix in a public bucket is insufficient. Moving/deleting historical files and purging their caches require explicit target verification and authorization. No cleanup script was executed or added here.

## Schema and rollout requirements

- Generated Payload types were regenerated from the actual configuration with dummy service settings, without initializing a database. The checked-in numeric-ID typing convention was retained; runtime ID validation supports numeric and Mongo-style string IDs.
- MongoDB: the new optional relationship can be stored without a SQL migration, but actual index creation and all schema effects must be reviewed in staging. No historical ownership backfill was performed. Guest access can be recovered through a new signed link sent to the recorded email; do not attach legacy orders to an arbitrary unverified account with a matching email.
- PostgreSQL: migration `20261023_000000_order_customer_account` adds the nullable owner FK/index and is registered chronologically. It is **not applied or DB-tested**. Test on a backed-up isolated PostgreSQL database before serving this code with SQL schema push disabled. SQLite/Turso requires its own approved schema update/validation before rollout; no SQLite migration is claimed.
- Verify real shipping fields are populated and valid. Missing/invalid financial settings must not silently become invented fees. Replace template bank/wallet destinations before enabling those methods. Payload email adapter configuration/delivery remains an existing verification item; a nodemailer package being installed does not ensure signed recovery emails are delivered.
- Test guest COD, reference-only transfers, price changes, account ownership, expired/forged links, admin stock/status changes, direct REST/GraphQL access and private cache headers in staging. The existing app-server E2E suite contains pre-existing assumptions about `/admin`, anonymous admin APIs, fixed seed IDs and shared dotenv settings. It was not executed against this environment; it needs isolation-aware fixtures and updated authenticated flows before being a release gate.

## Verification

- Vitest: 207 tests passed across 25 files at the batch checkpoint, including handler authorization, streamed-body caps, malicious input, quote confirmation, exact minimal tracking, guest capabilities, order-page access and collection policies. These use mocks/local objects, not a real transaction-capable database.
- Isolated Chromium: all 19 tests passed, including the changed-quote confirmation and screenshot-disabled checkout flow, plus existing homepage/image/video/storefront regressions. Synthetic media and mocked checkout endpoints only; no application server, R2 or real payments.
- TypeScript: passed. Targeted backend/security/checkout ESLint: zero errors and 41 warnings at the checkpoint; existing `any` warnings remain. Full-repository lint was already failing in the audit; unrelated lint debt is not represented as resolved.
- Production build completed (exit 0), with warnings and expected refused loopback connections during build-time CMS/cache attempts. It used dummy service settings and an unavailable loopback database URL, not production services. This validates build compatibility, **not DB operation, index existence or deployed behavior**. Subsequent source changes after that build were limited to presentation text, formatting, a read-only legacy screenshot field and additional tests; TypeScript and local tests are the final-state gates.

## Still pending before full P0 sign-off

1. Mongo-backed unique checkout idempotency key and payload fingerprint, same-result retry recovery, timeout-after-commit handling and order-number collision recovery.
2. Verify effective replica-set transactions, then atomic/conditional stock allocation and a movement ledger covering last-unit contention, duplicate lines, cancellations/reactivation, backorders, active-item edits and deletes. Move authoritative quote/stock reads into the intended transaction boundary. The present pre-create quote can race an administrative price change; current live stock prechecks do not reserve stock.
3. Durable post-commit outbox for emails and future invalidation, retry/dead-letter handling and dispatcher provisioning. Existing unawaited order emails are not made durable by this batch.
4. Distributed/edge abuse controls and request quotas for checkout, tracking, registration, recovery emails and future private uploads; origin-domain bypass review. In-process counters alone are not a fleet-wide limit. No Redis was introduced.
5. Configure private receipt storage, implement and validate the replacement upload/download flow, then authorized historical receipt cleanup/purge.
6. Verify commercial hosting eligibility/plan, regions, backup/restore, actual cache rules and staging capacity. No 500-user claim can be made yet.

Next coding batch can proceed with idempotency/transaction design while the private bucket is prepared. Do not treat this batch alone as safe completion of the full purchase-integrity work, and do not run default DB-backed tests against production configuration.
