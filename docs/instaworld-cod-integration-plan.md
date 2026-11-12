# InstaWorld COD integration plan

Reviewed: 11 November 2026. Status: planning only; no credentials configured, live shipments booked, COD switches enabled, or production data changed.

Implementation update: the owner subsequently approved a manual API booking button for Processing COD orders and on-demand tracking. That initial integration is now implemented locally; see [setup, safeguards and current limitations](instaworld-manual-booking.md). This remains the broader planning record, not a claim that its settlement, scheduling, AWB or cancellation phases have been implemented. No live provider operations or production activation have been performed.

## Latest owner decision — 11 November 2026

The owner confirmed **an explicit Book with InstaWorld button in this store's admin after processing**, not automatic booking on checkout. Pickup addresses are managed in the merchant's InstaWorld account; the website loads authorized pickup IDs and sanitized display details from that account, not a second pickup address source. The flat-shipping change remains independent of courier billing.

Customer shipping is now a nationwide **Rs.250 flat fee by default**, configurable under Site Settings → Shipping Configuration → Flat Shipping Fee — All Cities (PKR). City tiers are obsolete and ignored. Free shipping is off unless explicitly enabled through its separate admin toggle/threshold. Existing order totals and separate COD handling charges are unchanged. The merchant must update any previously saved announcement-bar promotional text if it advertises free shipping or a different rate. Courier costs remain separate from customer shipping prices. The rest of this document describes potential future integration scope; old city-rate recommendations are superseded by this flat-price decision.

## 1. Verified API contract and limits

Primary sources: [documentation](https://one-be.instaworld.pk/merchant-api/v2/docs) and its [OpenAPI specification](https://one-be.instaworld.pk/merchant-api/v2/openapi.yaml). The docs are a ReDoc shell; the specification was read directly. The linked CHANGELOG.md returned 404 during review. Account-specific behavior and negotiated tariffs remain unverified without authorized account access.

Base URL: `https://one-be.instaworld.pk/merchant-api/v2`. Requests authenticate using a **v2** bearer key in Authorization, never a browser request, query string or request-body credential. The old v1 location key is not interchangeable. Brand-wide credentials require an explicit pickup location when booking; location-scoped credentials can default to their bound pickup. Reference responses can expose a legacy location key: strip it from all browser responses and logs.

Verified capabilities to integrate:

- `GET /me`: connection test, account identity, key scope and visible pickup locations.
- `GET /locations`: select an active authorized pickup location.
- `GET /cities`: exact supported destination names; provider caches this list for one hour. It is not a province catalog or a price list.
- `GET /couriers?location_id=…`: available carriers and COD/prepaid/open-parcel flags. A destination-specific carrier availability guarantee is not documented; booking can still fail.
- `POST /shipments`: book a consignment using a durable idempotency key. Successful creation assigns a tracking number; reported booking failure means no booking. Provider idempotency retention is **24 hours**, not forever.
- `GET /shipments?ref_no=…`: reconcile ambiguous booking outcomes against the merchant order reference. Reference uniqueness is not promised by this schema.
- `GET /shipments?updated_since=…`: incremental shipment synchronization with cursor pagination. Provider recommends every 10–15 minutes rather than a timer per order.
- `GET /shipments/{tracking_number}` and `/events`: order-specific current state and history, fetched on demand.
- `GET /shipments/{tracking_number}/awb`: private PDF shipping label.
- `POST /shipments/{tracking_number}/cancel`: cancellation only before pickup, while booked. After pickup it may be refused. No return-request endpoint is documented.
- `GET /settlements` and `/settlements/{invoice_number}/shipments`: remittance and charges reconciliation; requires the settlement-read scope. Only finance-approved invoices are exposed. Absence of an invoice does not prove an order is unpaid or lost.

**Not documented in the published v2 specification:** checkout rate quotation, a city-wise tariff feed, city/province IDs, push webhooks, return booking, pickup scheduling, or a sandbox server. Do not invent endpoints or promise these features. Request clarification from InstaWorld for anything outside this contract.

Respect per-key limits: 120 requests/minute overall, 30/minute list operations, 60/minute shipment detail/events combined, and 20,000/day. Follow Retry-After and response limit headers. Money uses PKR; convert to integer minor units internally. Preserve source timestamps and convert deliberately for Karachi reporting.

## 2. Current application and changes required

The store already supports an admin-controlled COD switch, server-calculated shipping and COD fees, transactional order creation/stock allocation, checkout idempotency, private receipts for digital payments, and manual fulfillment tracking. COD creates a confirmed order and does not require a receipt. Actual money recording is separate from order value.

Current shipping rules use ten default major cities, a major/secondary rate and a free-shipping threshold, optionally overridden in Site Settings. These are **store policy**, not InstaWorld charges. Existing Pakistan province/city address validation is not courier serviceability validation. No product/variant shipping weight fields were found. Fulfillment carrier options are a fixed select, not a dynamic account carrier catalog.

Preserve all existing payment methods, receipt requirements, order emails, reporting definitions and stock safeguards. Do not retroactively book historical COD orders, silently change their charges, or toggle COD on during deployment.

## 3. Recommended customer and administrator journey

Customer selects province and city → server checks approved InstaWorld city mapping and coverage → customer sees the store's shipping/COD charges → customer confirms the server quote → order commits locally → admin reviews order → admin selects **Book with InstaWorld** → consignment/tracking and AWB become available → tracking synchronizes → delivery and financial settlement are reconciled separately.

Start with **admin-initiated booking**, not automatic booking on every checkout. This avoids creating paid fulfillment obligations for duplicates, unverifiable addresses, backorders, test orders or unreviewed COD orders. If later requested, add a separate auto-book switch after operational verification. An order being confirmed today is not proof an administrator has checked it; retain an explicit booking approval step.

Book only eligible confirmed/processing orders with complete address, supported destination, approved amounts and shipping weight. Do not block a committed customer order merely because the courier is temporarily unavailable; expose a recoverable booking error in admin. Prepaid shipment booking is a later optional extension and must use paid semantics only after payment verification, not just receipt upload.

## 4. City integration

Keep the Pakistan province/city catalog for address UX. Add a durable provider-city snapshot and an administrator-reviewed mapping from `(province, store city)` to the **exact** InstaWorld city string.

Mapping workflow:

1. Admin syncs cities from InstaWorld; keep the last successful snapshot, sync time and revision. A failed sync must not replace coverage with an empty list.
2. Normalize case, whitespace and punctuation for comparison only. Auto-propose unambiguous matches; aliases/spelling variants require approval. Do not silently map a small town to its nearest major city or guess a province from a name.
3. Each mapping has approved/provider-city, blocked/unmapped, and last-reviewed metadata. Same-name cities in different provinces must not be merged by name alone.
4. For InstaWorld COD checkout, show supported mapped destinations; if a previously selected city becomes unsupported, clearly disable COD and explain. Do not remove other payment choices that can genuinely be fulfilled through another approved route.
5. Server validates mapping independently at quote/checkout and again before booking. Persist the mapped name and coverage revision with the order/booking snapshot so later alias edits do not rewrite historical facts.
6. Cache public sanitized coverage, not upstream credentials or customer records. Recommend a configurable 24-hour maximum snapshot age for accepting new InstaWorld COD checkouts; stale or unavailable coverage disables this delivery option, not the entire store. Booking revalidates as appropriate. Provider rejection remains authoritative.

Initial app endpoints proposed: admin reference sync/status, public sanitized COD coverage, and server quote calculation. These are **our planned endpoints**, not claims of existing InstaWorld endpoints.

## 5. Charges by city: two different amounts

**Customer shipping price** is what the store chooses to charge at checkout. **Courier cost** is what InstaWorld deducts under the merchant's contract. Free customer shipping does not make the courier free. Keep these separate in order snapshots and reports.

There is no rate API in the reviewed spec. Obtain a written account rate card covering pickup origin, carrier/service, destination/zone, weight slabs and rounding, incremental weight, COD fees/percentages, taxes, remote areas, returns, fuel/other surcharges, and effective dates. Ask whether an additional account-specific quotation endpoint exists; do not assume it does.

Recommended first release: retain the store's fixed/customer-subsidized shipping policy, add explicit city/zone overrides where needed, and store an independently calculated **estimated courier cost** when a verified contract supports it. Never label an estimate as an API-returned quote. Later settlement charges are actual deductions and must not overwrite the customer's agreed order total.

Proposed admin rate configuration: delivery mode (legacy/store policy or approved rate card), origin, optional carrier/service, effective-dated rate-card version, destination zone mappings, base weight/price, additional weight increment/price, documented surcharges, separate customer COD handling fee, city-specific overrides, and explicit free-shipping policy. Retain a rollback path to the existing pricing mode.

Customer pricing precedence: explicit active city rule → mapped zone rule → explicitly configured fallback, only when that fallback is permitted for the mapped serviceable destination. Missing or invalid required rates must not become zero or silently inherit a made-up courier price. Enforce non-negative finite values and deterministic rounding. Apply the agreed free-shipping rule to customer shipping only; decide separately whether COD handling is waived. Do not add a courier COD fee twice if it is included in a bundled tariff.

`amount to collect = persisted merchandise subtotal + customer shipping fee + customer COD handling fee − applicable persisted discounts/credits`. Use the trusted order total for an ordinary unpaid COD order, never a browser amount. Part-paid orders need an explicit supported balance policy; block initial COD booking of these rather than guessing. The amount sent to the courier must not subtract courier deductions: the courier collects the customer's agreed amount, then remits under its settlement rules.

Add real product/variant weight in kilograms, packaging policy and immutable booking weight snapshots. Booking request items require `kg`; ask InstaWorld whether it is per unit and how packaging/chargeable weight should be represented. Do not assign every product an arbitrary weight or assume dimensional pricing is supported by v2. Block booking until missing weights are resolved.

## 6. Booking, persistence and duplicate prevention

Build a server-only typed client with fixed/allowlisted upstream host, timeouts, response validation and sanitized error handling. Use documented error codes, not matching human message text. Do not expose arbitrary proxy endpoints or upstream error details containing customer data.

Persist a shipment attempt separately from the order, with unique order/attempt identity, provider account and pickup location, body snapshot/hash, idempotency key, requested amount/weight, actor, claim/lease, request ID, status, tracking number, errors and timestamps. Store history/replacement links; design the initial action for one full shipment per order and explicitly reject unsupported split shipments.

Booking sequence: authorize admin and same-origin request → atomically claim an eligible order and immutable booking payload → release the database transaction → call InstaWorld → persist the verified outcome in a short transaction. Never hold MongoDB transactions or locks open across courier network calls. Preserve app-wide pooling; do not create a MongoClient or background interval per order.

Always send a provider idempotency key derived from immutable shipment attempt identity, with the identical body on retry. Double clicks and concurrent admins must converge on one attempt. A documented booking_failed outcome can retry. A timeout, unknown 5xx or lost local persistence after remote success is **ambiguous**, not automatically failed: reconcile using ref_no/location and verified shipment fields before rebooking. Multiple matches require review. Same-key conflict must not generate a new key behind the scenes. After the provider's 24-hour retention window, do not blindly replay create; reconcile or require explicit operator resolution. Editing order address/items/amount while booking is pending or active must be blocked or enter a reviewed cancel/rebook workflow.

Reuse existing Payload access controls and commerce transactions. Add provider readiness/index setup explicitly during rollout; do not perform schema/index creation on customer requests. Ledger snapshots and public orders should not expose keys, internal payloads or financial deductions.

## 7. Status, returns, cancellation and tracking

Store provider shipment status separately from order status and payment state. Preserve documented status code, source recorded/changed times, sync freshness and history; never infer state from display labels or courier-specific raw wording.

- BOOKED / BOOKING_IN_PROCESS: booking state only; not evidence of physical shipment.
- PICKED_UP / IN_TRANSIT / OUT_FOR_DELIVERY: update shipment progress and map eligible order state to shipped once, without duplicate email/analytics transitions.
- DELIVERED: delivery observation; not proof the store has received cash.
- DELIVERY_ATTEMPT_FAILED / ACTION_REQUIRED / ON_HOLD: exception needing attention, not an automatic order cancellation.
- RTO states: return progress. Only warehouse receipt and inspection should trigger the approved inventory return adjustment, exactly once.
- CANCELLED: reconcile courier cancellation and merchant order intent before changing order status. Never automatically invoke the current cancelled-order stock restoration for every courier failure/cancellation code.
- Claim and UNKNOWN/new statuses: retain evidence and flag review; do not guess financial or inventory outcomes.

Guard the current status dropdown, generic collection mutations and delete action for provider-managed shipments. A shipped/in-transit order cannot be locally cancelled/deleted to pretend the parcel has stopped. Confirm allowed pre-pickup cancellation remotely before finalizing local cancellation; reconcile ambiguous outcomes. After pickup, present return instructions/support escalation because v2 has no documented return action. Cancellation must never restock a physically travelling parcel. Keep manual fulfillment available for non-provider orders.

Track replacement AWBs using replaces/replaced-by references; do not treat replacement tracking as a second sale, second stock allocation or second collection. AWB download is admin-only through an authenticated no-store proxy, validates PDF response/content bounds, and is not stored in public R2. Guest tracking continues to require current order-access controls and reveals only safe timeline fields, not settlement/customer details.

## 8. Synchronization and operations

First release can use admin **Refresh tracking**, **Sync shipments**, and **Sync settlements** within this website. No separate hosted service is required for those actions. Show last sync, last error, mapping/rate freshness, ambiguous bookings, and retry/review controls. Manual sync is not automatic tracking when nobody opens the dashboard.

For unattended updates, configure a scheduled invocation of a protected endpoint in this same deployment, subject to the hosting plan's supported cadence. The API recommends incremental updates every 10–15 minutes. No webhook support is documented, so neither a browser interval nor post-response work can guarantee future tracking refreshes. Confirm schedule/plan and approval before provisioning; do not claim a scheduler has been added.

Use one incremental cursor per provider account/scope, with a distributed sync lease, bounded pages/runtime, progress checkpoints and a small overlap for timestamp ties. Process all pages before advancing the safe watermark; deduplicate repeated observations. Ignore stale regressions while retaining event evidence, and recheck detail for suspicious transitions. Bootstrap/import must link only proven matching store orders; flag unmatched portal shipments, never create sales or stock allocations from them automatically. Cache sanitized reference data across instances to avoid upstream calls per visitor.

## 9. Settlement reconciliation and reports

Build an admin-only COD report covering booked, in transit, delivered, failed/RTO, COD expected, provider-reported settled, approved invoice, paid invoice, actual charges, withheld taxes/adjustments and verified remittance differences. Keep separate dates for order placement, delivery and remittance. Do not call projected receivables collected revenue or profit.

Import settlements and per-shipment lines idempotently by provider account/invoice/tracking identity. Respect pagination and repeated invoices; refresh non-final/recent records so paid-state changes and late adjustments are discovered. Persist source amounts/timestamps and nullable fields honestly. Invoice-level taxes, miscellaneous deductions and adjustments cannot be allocated to individual cities/orders by guesswork. Per-shipment charges alone may not reconcile the entire invoice.

Initially show a reconciliation draft for administrator approval. A provider PAID invoice and a bank credit are distinct evidence; only approved, verified actual remittance should create an immutable existing money-ledger collection with cod_remittance reason and stable external import identity. Never record both delivery value and net remittance as two customer payments. Gross COD, deductions and net bank remittance require an explicit ledger allocation contract before automation. Corrections append auditable adjustments; do not silently edit recorded payment history. Preserve current money/deletion restrictions.

## 10. Implementation batches and acceptance tests

1. **Foundation:** server-only credentials/client, admin connection test, pickup/carrier/city sync, reviewed coverage mapping, pricing/weight decision. COD remains off until coverage and charges are approved.
2. **Checkout:** eligible cities, server-side coverage and fee rules, quote confirmation on changed price, COD receipt exemption, rate/weight/location snapshots. Preserve all digital payment and receipt regressions.
3. **Fulfillment:** admin booking/approval, durable attempts/idempotency/reconciliation, AWB, guarded cancellation and manual status refresh. Verify safe account-specific booking before enabling any automatic mode.
4. **Tracking:** incremental sync, history/replacements/exceptions, customer-safe timeline, stock-safe returns and optional scheduled execution.
5. **Financial operations:** settlements, reconciliation exceptions, approved ledger imports, reporting/export.

Tests must cover missing/revoked/wrong-scope credentials, pickup ownership, inactive locations, duplicate/ambiguous city aliases, unknown/removed/stale coverage, fee precedence, free-shipping/COD interactions, weight/rounding, prepaid separation, address/phone validation, rate changes between checkout and confirmation, competing admins, timeouts after booking, conflicts and 24-hour expiry, successful booking with local persistence failure, pagination/timestamp ties, throttling, unknown states, cancellation racing pickup, failed delivery without restocking, physical return restocked once, AWB privacy, customer/admin access, settlement replay/deductions/mismatches, and unchanged checkout/receipt/email/inventory/report tests. Booking address max is 200 characters versus the application's longer address allowance: validate before booking and ask for correction; never truncate silently.

All automated tests use mocked provider responses or explicitly disposable local fixtures. The public specification lists production only: ask for a sandbox/test account first. Without one, any controlled live booking/cancellation requires explicit owner authorization because it may incur charges or dispatch a parcel. Finish with production configuration verification and one approved end-to-end operational test, not an unapproved bulk sync or booking of historical orders.

## 11. What the owner must provide/approve

- Active merchant account; v2 API key stored privately, authorized scopes confirmed through /me. Do not paste credentials into chat. Proposed server-only env names: `INSTAWORLD_API_KEY`, `INSTAWORLD_API_BASE_URL`, `INSTAWORLD_LOCATION_ID`; separate sync secret only if scheduled synchronization is approved.
- Intended pickup location, origin city and allowed carriers, automatic carrier selection preference, account COD/open-parcel policy. Recommend auto-selection with open parcel off initially, subject to contract.
- Written negotiated rate card and tax/return terms, or explicit approval to retain current customer shipping prices while actual courier deductions are reconciled later.
- Product/variant weights and packaging policy; provider clarification on weight units per item and chargeable-weight treatment.
- Approval for admin-reviewed booking first; whether existing automatic COD order confirmation should remain or be changed to a new review stage. No silent change to Purchase/confirmation analytics semantics.
- Manual sync initially or approved unattended scheduling frequency/hosting capability; bank settlement verification/reconciliation responsibility.
- Provider answers on sandbox, webhook support, any private rate endpoint, return requests and pickup workflow. Account-specific unknowns are rollout blockers for the corresponding feature, not assumptions to hide in code.

Recommendation: approve batches 1–3 first, using admin-controlled booking, approved serviceability and the existing customer-price policy unless a verified rate card is supplied. Add automated tracking and financial reconciliation in batches 4–5. This plan does not itself enable COD or authorize paid courier operations.
