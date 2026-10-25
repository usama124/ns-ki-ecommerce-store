# Store analytics implementation plan

Status (25 October 2026): browser/server journey instrumentation, operational Reports, history/stock tracking and actual payment/partial-refund recording are implemented locally. Browser/server analytics remain disabled pending property/privacy review and configuration. History and money recording each require explicit admin activation. Derived historical trend/aging dashboards, settlement/reconciliation, GA4 refund allocation and GA4 admin dashboards remain pending. See [analytics setup](analytics-setup.md), [server rollout](analytics-server-rollout.md), [admin reporting guide](admin-reporting.md), [historical operations rollout](historical-operations.md) and [payment recording guide](payment-recording.md).

## Outcome and current state

Give the client reliable reports for visitor acquisition and retention, product interest, cart and checkout abandonment, confirmed orders, and campaign performance, together with an integrated Payload admin reporting area for orders, products, inventory, payments, and fulfillment.

The initial unconditional GA4 tag has been replaced by a consent-gated direct loader using public configuration for the existing `G-PRKY09PGEB` ID. Product/list/cart and checkout-intent events are instrumented. Backend order/purchase events are implemented but not enabled or verified against Google. Historical shopping actions before instrumentation cannot be reconstructed from the original tag alone.

The cart lives in localStorage through `src/providers/Cart/index.tsx`. Checkout posts to `src/app/api/orders/route.ts`. Payload order hooks deduct inventory, auto-confirm COD orders, and process later status changes. Manual transfers initially await verification. A confirmed COD order represents accepted order value, not collected cash.

## Measurement decisions

Proposed conventions to agree with the client before enabling production purchase events:

- Use PKR and Asia/Karachi for reporting.
- `order_placed` means Payload successfully created an order, regardless of verification status.
- `purchase` means the first transition into confirmed order status. COD qualifies on acceptance; a manual transfer qualifies after verification. Display this metric as confirmed order value.
- Payment collection and delivered orders remain separate operational metrics. If the client requires paid revenue, add an explicit payment status and paid timestamp before using payment collection as the purchase trigger.
- A cancellation does not imply a refund. Emit `refund` only for a recorded monetary refund; add a refund record/workflow first.
- Stable product ID is `item_id`; size/color identifies `item_variant`. Use SKU as an additional field where useful, without changing item identity between funnel steps.
- Use the immutable database order ID for `transaction_id`; never use a customer's bank reference or payment-proof data.
- Browser interaction events have one owner each; server dispatch owns purchase. Do not also emit purchase from the thank-you page.
- Keep the existing direct Google tag integration. Google Tag Manager is optional, not a requirement. If adopted later, migrate ownership rather than running duplicate tags.

## Phase 1 — Foundation and privacy

Code deliverables:

- Add typed event definitions and a shared analytics helper, proposed under `src/lib/analytics/`.
- Add a single client analytics provider under the existing storefront providers. Keep one tag loader/configuration, make measurement configuration environment-aware, and disable production reporting from local/test/preview environments.
- Resolve consent requirements with the client and implement the selected consent approach before collecting events. Do not queue denied-consent interactions for later replay. Backend events must honor the recorded consent state too.
- Verify Next.js navigation, back/forward navigation, and initial page loads each produce one intended page view. Choose automatic history tracking or explicit sanitized page tracking; disable the competing method.
- Sanitize page URLs, referrers, search parameters, and titles before sending them. The order-tracking flow can place contact information in query parameters; raw automatic URL collection must not leak that information. Retain only an explicit allowlist of safe marketing parameters where appropriate.
- Never send emails, names, phone numbers, addresses, passwords, payment references, receipt URLs, free-form errors, or raw form data. Avoid identifying details in custom search terms as well.
- Analytics failure, blocked scripts, or denied consent must not affect shopping, account access, or checkout.

GA4 account deliverables:

- Client owns the property; provide developer access and client reporting access separately.
- Confirm the production domain/web stream, reporting timezone, currency, and enhanced-measurement settings.
- Configure internal and developer traffic filters, testing filters before activating exclusions.
- Choose retention settings, safe custom dimensions, and the required key events. Do not register unique order IDs as high-cardinality custom dimensions.
- Document campaign UTM naming for paid ads, Instagram, Facebook, email, and WhatsApp links.

Acceptance: one loader/configuration; one page view per tested navigation; no production traffic from test environments; no personal information in captured requests; shopping works with analytics unavailable.

## Phase 2 — Product and cart instrumentation

Implement the following event contract:

- `view_item_list`: emit for visible products in a named list, with list identity and item positions. Deduplicate within the same list/page impression; rendering below the fold alone is not an impression.
- `select_item`: emit once when the image/title link is activated, with the same list context.
- `view_item`: emit once per product page visit after product data is available. A size change is not another product-page view.
- `add_to_cart`: emit only for a successful quantity increase. Include the added quantity delta, not the resulting full cart quantity.
- `remove_from_cart`: emit the removed quantity delta for explicit removals and user quantity decreases.
- `view_cart`: emit when the drawer actually opens, not whenever its component rerenders.

Files in scope:

- `src/components/products/ProductGrid.tsx`: pass list identity/positions and coordinate impressions.
- `src/components/products/ProductCard.tsx`: product selection on both image and title links.
- `src/components/product/ProductDescription.tsx`: product view.
- `src/components/product/SizeSelector.tsx` and `StickyMobileAddToCart.tsx`: preserve the same item/variant data across desktop/mobile actions.
- `src/providers/Cart/index.tsx`: centrally own successful add/remove/quantity tracking so alternate controls cannot duplicate events. Keep analytics side effects out of React state-updater functions, which may be invoked more than once.
- `src/components/Cart/CartModal.tsx`: cart-open event.

Standard item payload: product ID/name, category, brand, variant, quantity, effective unit price, and list context when available. Standard monetary event payload: PKR and the sum of applicable item prices multiplied by quantities. Use actual discounted prices; report discounts consistently. Cart types currently lack full category/list context, so extend their analytics metadata or explicitly resolve it without treating it as authoritative pricing.

Do not emit cart interaction events when restoring localStorage, clearing the cart after checkout, or automatically correcting stock. A rejected add must not generate a successful add event. Automatic stock changes may use a separate safe diagnostic event.

Acceptance: identical item IDs throughout; accurate quantity deltas; one successful action produces one event; refused actions and rerenders do not inflate counts; mobile and desktop behavior match.

## Phase 3 — Checkout and trustworthy purchase reporting

Prerequisite update: server-authoritative checkout pricing, published-product/variant/quantity validation, trusted sale/shipping/COD calculations, idempotency and transactionally consistent administrator-edited totals have been implemented and locally verified during QA remediation. Generic order creation is administrator-only. Batch 2 now reuses these server snapshots with restricted context and a transactional analytics outbox; production activation and real ingestion remain pending. The following contract remains the rollout acceptance checklist.

Checkout events in `src/components/checkout/CheckoutPage.tsx`:

- `begin_checkout`: once per checkout entry with a populated cart, not every rerender.
- `add_shipping_info`: when validated shipping information is submitted, using a general shipping tier; no address or contact fields.
- `add_payment_info`: on valid submission with the selected payment type. Do not emit for merely opening a payment panel.
- `order_placed`: only after the successful order response. Return sanitized server-calculated item/value data rather than replaying browser prices.
- `checkout_error`: optional diagnostic event with an allowlisted code/stage, never the raw exception or customer input.

Purchase delivery:

- Capture consented GA client/session identifiers at checkout without making checkout depend on their availability. Persist the consent snapshot and event context server-side with restricted access.
- Use order hooks in `src/collections/Orders.ts` to enqueue the first eligible purchase; avoid unawaited network calls as the only delivery mechanism.
- Create an admin-only analytics outbox collection and a durable worker/cron. Store a unique event key, trusted payload snapshot, occurred-at time, attempt count, dispatch state, and sanitized error details. Ensure database uniqueness supports idempotent enqueueing.
- The order mutation and enqueue should share the Payload request/transaction where supported. Add a reconciliation job for eligible orders without an outbox entry so failures do not silently drop reporting.
- Send backend events through GA4 Measurement Protocol with a server-only API secret. Validate requests using Google's validation endpoint during QA. Apply documented time/session-attribution limits: a payment verified days later cannot be assumed to belong to the original browsing session.
- Use stable transaction IDs and persistent dispatch state; repeated updates, worker claims, and cancelled-to-confirmed transitions must not intentionally create another purchase for the same order. A network timeout leaves delivery uncertain: batch 2 quarantines ambiguous sends for manual review instead of blindly retrying. Do not claim guaranteed exactly-once delivery.
- Respect consent and missing identifiers: record why an event was skipped, do not invent visitor identities or claim full coverage. Operational order totals remain the reference.
- Keep reporting annotations for cancellations and refunds; purchase count is a historical milestone and not the current count of valid orders.

Files/configuration: order API, Orders collection, Payload collection registration, generated Payload types, outbox/worker implementation, deployment cron and server-only environment secret. Add schema migrations if required by the configured adapter; verify on MongoDB used by production.

Acceptance: trusted totals and snapshots; COD and transfer rules match the documented milestone; no purchase on failed/unconfirmed transfer creation; one logical purchase per order; retry/reconciliation verified; secrets never reach browser bundles; analytics outages do not lose accepted orders.

## Phase 4 — Client reports and abandonment

Configure GA4 acquisition, retention, ecommerce, and funnel reports. Start in GA4; an optional Looker Studio dashboard can combine presentation needs with operational aggregates.

Report definitions:

- Audience: total/active/new/returning users, sessions, engagement, landing pages, device, approximate geography, and acquisition channel.
- Cart abandonment: users who added to cart without placing an order within the selected window. Use `order_placed` so pending bank verification is not mislabeled as an abandoned cart.
- Checkout abandonment: users who began checkout without placing an order in the window.
- Confirmation rate: placed orders reaching confirmed status, separate from checkout abandonment.
- Conversion: state explicitly whether the denominator is sessions or users and whether the outcome is order placement or confirmed purchase.
- Products: views, add-to-cart users, purchased quantity, confirmed item revenue, and view-to-purchase performance. Distinguish event counts, units, and unique users.
- Trending: compare the last seven complete days with the previous seven, showing absolute counts and growth. Apply a minimum-volume threshold so one view does not appear as a major trend.
- Operations: paid, delivered, cancelled, and refunded order metrics from Payload, labeled separately from GA4 attribution.

Build a same-session funnel and a separate seven-day conversion-window exploration/cohort. Keep entry conditions and sequence explicit; avoid subtracting unrelated event counts across dates. GA4 retention, identity, consent, and report limits constrain these analyses. Consider BigQuery export for repeatable longer-term cohort reporting if needed, after agreeing cost/access.

Acceptance: dashboard totals have clear definitions, date windows and currency; attribution and operational totals are not conflated; the client can find every requested metric without editing code.

## Phase 5 — Integrated admin reporting

Batch 3 implements delivery batches 1–2 below using existing trustworthy fields. The Reports shell has all five sections, but Payments & Fulfillment currently shows placed-cohort/current-status breakdowns only. It deliberately does not infer cash collection, refunds, event timestamps or complete stock history. Exports are synchronous and explicitly limited to 5,000 rows; background exports remain future work. MongoDB is the supported reporting adapter for this release. See [admin-reporting.md](admin-reporting.md) for precise scope and limitations.

### Entry point and architecture

Add a Reports navigation entry at `/store-admin/reports` with Overview, Orders, Products, Inventory, and Payments & Fulfillment views. Reuse the existing Payload admin shell and design tokens. Keep inventory editing and order processing in their existing dashboards; report rows link to the relevant records/screens for action.

Use Payload/MongoDB as the authoritative source for operational reports. GA4 supplies visitor and behavioral metrics only. Existing orders/inventory dashboards remain starting points, not a complete reporting layer: the old 500-order/300-product caps were replaced during QA remediation by pagination and full-history order summaries; inventory counters/filters are explicitly page-scoped. New reporting totals must cover the full matching dataset, independently of detail-table pagination.

Proposed implementation locations:

- Register the Reports view in `src/payload.config.ts` and regenerate the admin import map.
- Add `src/components/admin/ReportsNavLink/` and `src/components/admin/ReportsView/` with a server wrapper and interactive report UI.
- Create a shared `src/lib/reports/` service for filters, metric definitions, monetary calculations, aggregation, and exports.
- Add authenticated `/api/admin/reports/` endpoints for each report, with shared authorization, validation, and response contracts.
- Reuse/fix `src/app/api/admin/dashboard-stats/route.ts`, `src/app/api/admin/orders/route.ts`, and `src/app/api/inventory/route.ts` so old dashboard cards and new reports agree. Avoid maintaining competing definitions of revenue.

### Shared report controls

- Date presets: today, yesterday, last seven/thirty days, this month, previous month, and custom range. Use Asia/Karachi calendar boundaries converted to UTC, with inclusive start/exclusive end.
- Display the date basis explicitly: placed-at for order cohorts, confirmed-at for confirmations, paid-at for collections, and movement-at for stock changes. Current stock is an as-of-now snapshot, not a historical date-range total.
- Compare against the previous equivalent period. Show absolute change; when the previous value is zero, display a clear unavailable percentage instead of infinity.
- Apply status, payment method, product, category, variant/SKU, city, and courier filters where meaningful. Persist filters in the report URL without including customer contact data.
- Provide summary metrics, daily/weekly/monthly trends, sortable/paginated detail rows, and drill-down links. Include currency, units, exclusions, date basis, and last-updated time.
- Export filtered CSV in the first release. Export every matching row rather than just the visible page, with the same definitions as the dashboard. Provide asynchronous exports with expiry for large datasets. Neutralize spreadsheet formula injection in exported strings; log export requests and restrict personal-data columns.
- Show loading, empty, partial/unavailable data, and errors distinctly. A failed database/GA4 request must not silently display valid-looking zero totals.

### Orders reports

- Order counts and placed order value, broken down by date, status, payment method, city, and courier.
- Current confirmed/processing/shipped/delivered/cancelled counts and values; label these as current status of the selected order cohort.
- First-confirmation milestones using recorded timestamps/history, separately from current status. Moving an order backwards must not erase historical milestones.
- Average order value with a documented status set and denominator; item units per order; product subtotal, shipping, COD charges, discounts, and order grand total as separate metrics.
- Cancellation rate/reasons, pending-verification aging, unfulfilled-order aging, and time to confirmation/shipping/delivery where timestamps exist.
- Order detail export and drill-down to the existing orders dashboard or Payload order document.
- Distinguish order date reports from fulfillment activity occurring in the selected period. Never sum counts across multiple status transitions as if they were distinct orders.

### Product reports

- Product/variant ranking by units sold, confirmed item revenue, and distinct order count, with cancellation/refund treatment displayed.
- Breakdowns by category, size, and SKU; sale versus regular pricing where immutable price/discount snapshots exist.
- Product revenue uses item price multiplied by quantity and excludes shipping/COD fees. Avoid counting one multi-category product's revenue more than once in totals; group by primary category for additive category reports.
- Low-selling and zero-selling products within a selected period, with publish/launch dates considered.
- Combine product views/add-to-cart/conversion from GA4 only when that integration is available. Show missing behavioral metrics as unavailable, not zero. Join by stable product ID; keep GA4 aggregate scope separate from database order totals.
- Preserve historical product title, category, variant, SKU, and unit price in order items so renamed/deleted products remain reportable.
- Do not offer gross profit until cost-of-goods snapshots exist. Current selling price is not inventory cost or profit.

### Inventory reports

- Current stock per product and stable variant ID/SKU; in-stock, low-stock, out-of-stock, and backorder-enabled variants.
- Configurable low-stock thresholds with an explicit fallback. Backorder permission must not imply that stock exists.
- Stock movement history: sales deductions, cancellation restorations, restocks, manual adjustments, and reconciliation corrections, including before/after quantity, delta, reason, linked order, actor, and timestamp.
- Stock aging, historical balance, sell-through, and stock coverage only after movement/snapshot data is available. Define coverage from a chosen sales period and handle zero sales without division errors.
- Optional inventory cost valuation after variant unit costs and valuation policy are added. A stock × retail price figure, if shown, must be labeled retail stock value rather than cost valuation.
- Existing stock deduction clamps backorders at zero. Record requested quantity and fulfilled stock delta separately; do not infer backorder demand or exact cancellations/restorations from a clamped balance. Review reservation/deduction/restoration rules before enabling movement-based accounting.
- Ledger generation must cover all stock mutation paths: order hooks, cancellation/reopening, inventory endpoint, and direct Payload product edits. Use stable variant identifiers rather than mutable array indexes.

### Payments and fulfillment reports

- Accepted COD order value, outstanding COD, collected COD, verified transfers, pending verification, and actual refunds as distinct totals.
- Add explicit collection/payment states and timestamps; current order confirmation/delivery cannot prove collected cash or courier settlement.
- Support partial payments/refunds through payment/refund records if required. Record amount, currency, date, method, reason, and actor; make external references private operational fields.
- Shipping/delivery volume by courier, pending dispatch, transit aging, delivery time, and cancellations. Capture shipping/delivery timestamps; use order history rather than `updatedAt` as event time.
- Courier remittance/settlement reconciliation is a later extension requiring settlement records/imports. Do not label outstanding COD as collectible settlement without those records.

### Data and schema prerequisites

- Extend order items with immutable product/category/variant/price/discount snapshots, add status history and first milestone timestamps, and add payment/refund records as needed.
- Introduce an append-only stock movement collection with transaction-aware writes and unique operation keys. Opening stock at rollout is the baseline; historical movements cannot be reconstructed reliably from current balances.
- Add per-variant thresholds and stable IDs, and optionally cost snapshots for future valuation. Ensure products/variants with history are archived or soft-deleted rather than destroying report identity.
- Backfill only facts provable from existing records. Preserve unknown historic payment dates, status transitions, and stock movements as unknown; document coverage start dates.
- Regenerate Payload types/import map and manage adapter-appropriate schema changes. MongoDB production still needs explicit backfill/index rollout planning.

### Authorization and performance

- Authenticate and require the admin role on every reporting, export, and supporting operational endpoint. Existing endpoint access fixes are implemented; preserve them and protect every new endpoint independently, even when admin navigation is hidden.
- Use explicit access behavior for Local API operations; authenticate first and pass the user with `overrideAccess: false` where acting on behalf of that user. Define access for reporting collections and sensitive payment/export data.
- Validate filter/sort/date inputs, use fixed aggregation stages, and limit expensive synchronous report windows. Never accept arbitrary database aggregation from the browser.
- Aggregate in the database and paginate detail rows. For MongoDB, implement optimized pipelines/indexes for actual collection shapes; isolate adapter-specific logic if Postgres/SQLite support remains a requirement.
- Index measured query patterns such as order date/status/payment method and ledger variant/date. Benchmark representative data larger than existing endpoint caps.
- Cache only authorized aggregates using all filters and permission scope in the key. Invalidate after relevant changes or display bounded freshness explicitly. Daily summaries can be added when direct queries become expensive, with reconciliation to source records.

### Optional GA4 metrics inside admin

Add a separate Traffic & Conversion report backed by the GA4 Data API if the client wants visitor metrics directly in Payload. Use server-only credentials and property access, compatible dimensions/metrics, cached aggregate queries, quota handling, and GA4 data-freshness labels. No embedded private report should depend on exposing credentials or making the property public.

Core order/product/stock reports must work without GA4 credentials. Behavioral and operational figures can differ because of consent, attribution windows, processing delays, and tracking blockers; disclose their source rather than forcing equality.

### Acceptance and delivery batches

1. Reporting foundation: secure endpoints, common filters, metric definitions, Reports navigation, and overview/order reports using existing trustworthy fields.
2. Product performance and current inventory: consistent aggregates, paginated detail, CSV exports, and record drill-downs.
3. Historical operations: order status history, payment/refund recording, stock ledger/opening baseline, and resulting trend/aging reports.
4. Optional GA4 admin integration and later cost/settlement reporting.

Verify totals against database fixtures containing multiple line items, sizes, categories, statuses, partial refunds, and records beyond pagination caps. Cover Karachi day boundaries, mixed date bases, cancelled/reopened orders, deleted/renamed products, export consistency, formula-safe CSV, unauthorized access, cache isolation, zero denominators, and historical-data gaps. Reconcile opening stock plus ledger movements to current stock. Agree a response-time target using the deployment and realistic data volume before release.

Acceptance: an authenticated administrator can filter, compare, drill into, and export order, product, and inventory reports; totals include all matching records and have explicit definitions; non-admins cannot retrieve reports/exports; historical and payment-dependent metrics are enabled only when supporting data exists.

## Phase 6 — Optional engagement tracking

After the core funnel is reliable:

- Safe site searches and no-result searches in `src/components/navigation/SearchOverlay.tsx`.
- Size selection, stock failures, and sale engagement.
- Shoppable video plays and product clicks in `src/components/ShoppableVideos/` and its rendered video components.
- WhatsApp and social link clicks in `src/components/Footer/index.tsx`.
- Successful login/signup; optionally an opaque internal user ID when consented. No email-based user IDs.
- Wishlist intent only: the current product-card heart is local component state and does not represent a persisted wishlist.

Register only custom dimensions needed for actual reports. Do not turn every click into a separate custom event.

## Verification and release

1. Use a staging/test stream with dedicated test orders. Validate event shapes and privacy before production.
2. Check Google Tag Assistant, GA4 DebugView, and actual network payloads. Verify report ingestion separately; a successful HTTP response alone does not prove valid Measurement Protocol data.
3. Cover initial/client navigation, back/forward, product lists, size variants, sale prices, cart deltas, empty carts, rejected stock actions, guest/member checkout, COD, transfers, failed requests, reloads, and repeated order updates.
4. Test consent accepted/denied/revoked, blocked tags, queue delivery failures, worker restarts, and duplicate processing.
5. Add focused automated tests for money/item normalization, successful cart mutations, purchase eligibility, idempotent enqueueing, retries, and privacy allowlists.
6. Compare tracked test transactions against database snapshots; investigate currency, shipping, discount, and quantity differences. Set a documented production reconciliation cadence and alert on outbox failures.
7. Deploy in phases, verify the production stream/domain and cron, and give the client a short report guide. Record the launch date; pre-launch ecommerce data will not exist.

## Dependencies and starting point

Required from the client: GA4 property access, approval of confirmed-order versus paid-revenue semantics, visitor/consent requirements, and campaign naming ownership. Access changes can be handled separately from code preparation.

Required from deployment: server-only Measurement Protocol credentials and an authenticated scheduled worker mechanism. No credentials should be committed.

Admin reporting additionally requires agreement on metric/status definitions, payment collection workflow, inventory baseline date, reporting permissions, export contents, and expected data volumes. Optional GA4-in-admin reporting requires Data API credentials/property access; operational reporting does not depend on that connection.

Batches 1–3, historical operations and actual-money recording are implemented in code. Admins can record partial collections/refunds with durable transactional audit history; no money transfer or GA4 refund is initiated. Next: derived history/aging reports, reconciliation/settlement and bookkeeping corrections, GA4 funnels/admin integration, and controlled analytics activation/ingestion validation. Existing reports work without GA credentials. Historical operations and money recording each require explicit activation; external accounts/production tracking remain unchanged until configuration and rollout approval.

## Primary references

- Ecommerce events: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- Page views and duplicate prevention: https://developers.google.com/analytics/devguides/collection/ga4/views
- Measurement Protocol: https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference
- Purchase journey reports: https://support.google.com/analytics/answer/13128171
- Personal-information restrictions: https://support.google.com/analytics/answer/6366371/
- Cookie/user recognition: https://support.google.com/analytics/answer/11397207
