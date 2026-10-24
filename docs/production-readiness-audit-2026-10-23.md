# N’s KI: production-readiness and scalability audit

Date: 23 October 2026, Asia/Karachi. Repository revision: `b6281b8`.

**Scope: audit and proposed plan only. No remediation has been implemented.** This report is the only repository addition from this audit. No environment files were read, changed, or copied; no credentials, database access, migrations, dependency installation, production requests, or load tests were used. Provider documentation was browsed. Repository statements describe this revision, not a remotely verified deployment. The infrastructure/plan descriptions supplied by the owner are not independently verified account settings.

Evidence labels:

- **Confirmed:** visible in source, lockfile, installed dependency implementation, or completed static check.
- **Conditional risk:** the code permits a failure mode, but its manifestation depends on deployment settings, concurrency, or data.
- **Measurement required:** latency, actual indexes, cache hit rate, connection counts, deployment configuration, or live behavior cannot be established locally.

Source references below identify repository-relative files, functions and line numbers at the audited revision. Installed dependency references corroborate framework behavior without initializing the application. No exploit was executed against any environment.

## A. Executive summary

**Recommendation: resolve P0 security and purchase-integrity issues before a marketing traffic spike. Do not add Redis first.**

The most serious findings are not cosmetic performance problems:

1. Custom administration APIs do not authenticate callers and bypass collection permissions. Orders/customer details can be returned; stock, fulfillment, order status and sale settings can be changed through these handlers. Payload’s authenticated admin screen does not protect independent Next.js API routes.
2. Checkout trusts browser-supplied prices and fees. The public Payload order-create API is an additional purchase path with broader writable fields than the custom checkout handler.
3. Order detail pages fetch orders with access control bypassed and do not check ownership. The parent account layout checks whether someone is logged in only to decide whether to display navigation; it does not reject access.
4. Payment receipts share a publicly readable media collection and public-media URL generation with product photography.
5. Inventory uses read/replace operations, permits unmatched variants without an error, and has no durable checkout idempotency key. MongoDB transaction support is possible and nested stock operations correctly pass `req`, but the deployment’s effective transaction state is unverified. Do not label current overselling either proven or impossible.
6. Vercel’s published Hobby policy restricts it to personal, non-commercial use. A client’s trading ecommerce store needs an eligible hosting plan independent of whether a performance test passes. See section I.

Performance foundations already present are worth preserving: Payload’s cached initialization, small configurable pools, cached shell globals/categories, 50-product listing pagination, card projections, batched cart validation, WebP derivatives and browser `srcset` selection, and a database-independent global 404.

The main likely throughput costs are request-time public catalog reads, relationship population/serialization, full-dataset dashboard reads, substring search, and per-line inventory round trips. **500 concurrent visitors is not a capacity measurement.** Production capacity remains unknown until authorized staging tests measure request mix, database operations and latency.

## B. Architecture map

### Verified stack and deployment uncertainty

- `package.json` and `package-lock.json`: Next.js **16.3.3**, React **19.2.6**, Payload **3.88.0**, TypeScript **5.7.2**, Tailwind **4.1.18**, Sharp **0.34.2**. Lockfile resolves Mongoose **8.24.1** and its MongoDB driver **6.20.0**. The lock is npm lockfile v3; `packageManager` declares pnpm 12.3.4. No tracked pnpm lockfile was found. Standardize the production installer/lockfile before depending on reproducibility.
- `src/payload.config.ts:36–75`: selects MongoDB when adapter/URI matches; otherwise supports SQLite/Turso or falls back to PostgreSQL. MongoDB is the owner-reported production adapter, not inferred simply from installed packages. No database migration is recommended.
- `package.json` permits Node 18 as well as newer versions, but the locked Next version requires a newer runtime. Local static checks used Node 22.23.2. Vercel’s actual configured Node version and runtime region require account verification. No tracked Node-version pin or `vercel.json` was found.
- Next.js App Router, server components and Node-based Payload/API handlers; no repository middleware/proxy intercepting every request was found. MongoDB/S3/Sharp code is not an Edge-runtime design.
- `src/app/(payload)/api/[...slug]/route.ts` exposes Payload REST operations. GraphQL and GraphQL playground routes also exist. Custom `src/app/api/**` routes override matching REST paths; **both custom and generated endpoints must be audited**.
- Collections registered: users, pages, categories, products, media, orders, sizes. Globals: header, footer, homepage, site settings, sale settings. The form-builder plugin adds forms/submissions; its payment field is explicitly disabled. No active gateway, coupon collection, payment webhook handler, durable job worker or scheduler was found in the registered application.

### Request and dependency flow

```text
Browser
  ├─ document / RSC navigation → Cloudflare (only if proxied; settings unverified)
  │    → Vercel Next.js → shared Payload instance per warm process
  │       ├─ Next Data Cache: shell globals + category hierarchy (60 seconds)
  │       ├─ MongoDB: catalog / orders / users / media metadata
  │       └─ HTML + serialized client-component props → browser
  ├─ image/video bytes → configured R2 public/custom host
  │    └─ Cloudflare asset cache eligibility depends on host/rules/headers
  ├─ localStorage cart (no database write on ordinary add-to-cart)
  ├─ /api/users/me on AuthProvider mount → Payload authentication
  └─ checkout → optional /api/media receipt upload → /api/orders
       → Orders hooks → stock reads/writes → order persistence
       → unawaited Resend email promises → response / confirmation navigation

Admin UI → custom /api/admin/** and /api/inventory/** handlers
  → Payload Local API (not automatically protected by admin-page authentication)
```

**Home:** `HomePage`, `src/app/(app)/page.tsx:19–44`, is force-dynamic and runs homepage-global depth 2 plus eight featured products depth 1 concurrently. Linked reel products include variants and video relationships. The client renders product cards/reels; visible reels fetch media directly.

**Shop/category:** `ShopPage:28–73` and `CategoryPage`, `src/app/(app)/shop/[category]/page.tsx:47–94`, use the cached category tree and one 50-product paginated query with projections and depth 1. Category filtering includes descendants through `categoryProductFilter`; no database query per descendant is performed. Metadata and page both call the cached category helper. Search submits to `/shop?q=...`; the category route itself does not apply `q` in its query.

**Product detail:** `queryProductBySlug`, `src/app/(app)/products/[slug]/page.tsx:140–169`, does one depth-2 lookup with a published-status condition outside preview. React `cache()` deduplicates metadata/page reads within a render; it is not a cross-request catalog cache. Gallery/video/purchase components run in the browser after server data arrives. `draftMode()` in the root storefront layout and lookup makes rendering request-aware.

**Cart:** `src/providers/Cart/index.tsx:82–217` stores items, prices and stock hints in localStorage. Those are untrusted/stale by design. Cart-drawer checkout invokes the batched `/api/inventory/validate-cart`; direct navigation or direct API submission can bypass that client step. Validation is not reservation.

**Purchase:** `CheckoutPage.handleSubmitOrder:107–160` sends browser totals and items to custom `POST /api/orders`. The handler maps each submitted `price` to `unitPrice`, creates the order, and triggers `Orders.beforeChange → validateAndDeductStock`. COD becomes confirmed immediately; bank transfer/JazzCash/EasyPaisa remain manual-proof verification workflows. No processor capture request occurs. Admin status changes can restore/re-deduct stock and trigger emails.

**Authentication/accounts:** Payload user authentication; role field create/update is admin-restricted and customers can read/update only their own user document. `AuthProvider` performs one session lookup when the provider mounts, not a constant polling loop. Order ownership is not implemented consistently; see C2/F.

**R2/media:** `src/plugins/index.ts:31–166` conditionally enables S3-compatible R2 storage, direct client uploads and generated public URLs. Media metadata lives in MongoDB. The installed signed-upload handler defaults to requiring an authenticated user—not specifically an admin—while ordinary media creation is public. Customer receipt uploads use `/api/media` multipart, not that direct-upload client flow.

## C. Critical findings

### C1 — P0 / critical: custom admin API authorization bypass

**Confirmed source behavior.** No caller authentication/role check in:

- `src/app/api/admin/orders/route.ts:5–89`, `GET`: depth-2 read of up to 500 orders, `overrideAccess: true`, returns full filtered documents including customer/proof data.
- `src/app/api/admin/orders/update-status/route.ts:5–69`, `POST`: reads/writes arbitrary supplied order IDs with `overrideAccess: true`; can cancel, restore stock, reactivate, alter courier information/notes, and return updated orders.
- `src/app/api/inventory/route.ts:5–64`, `GET`: up to 300 products depth 2, including unpublished products, variants and stock.
- `src/app/api/inventory/update/route.ts:5–73`, `POST`: stock replacement with `overrideAccess: true` and no authorization.
- `src/app/api/admin/sale-settings/route.ts:118–162`, `POST`: updates a global via Local API without `overrideAccess: false`; the default bypasses the global’s `adminOnly` access. Its GET also lacks authorization.
- `src/app/api/admin/dashboard-stats/route.ts:5–39`, `GET`: default-bypass reads of orders, users and products; exposes business totals and an expensive workload.

**Impact:** confidentiality, unauthorized commercial configuration, order/inventory integrity, email abuse and resource exhaustion. Exact external exposure depends on deployment routing/firewall protection not present in this repo; a locked admin page alone is insufficient.

**Plan:** shared server guard using `payload.auth({ headers: req.headers })`, require admin role, pass authenticated `user` plus `overrideAccess: false` (or a deliberately scoped request context); validate origin/CSRF for cookie-authenticated writes, bound batches, and return minimal DTOs. Apply to every custom handler, not only the UI. Separate genuinely public sale display data from admin configuration APIs. Validate guest/customer/admin permission matrices in isolated staging tests. **Type: code + tests; complexity M; no new infrastructure required.**

### C2 — P0 / critical: order detail ownership bypass and weak tracking lookup

`OrderPage`, `src/app/(app)/(account)/orders/[id]/page.tsx:22–45`, reads any supplied order ID with `overrideAccess: true` and no authentication/ownership test, then renders name, phone, email and delivery address at lines 93–102. The parent `(account)/layout.tsx:9–28` authenticates only to show account navigation; it does not redirect guests. An ID in an email link is not an authorization credential.

`GET /api/orders/track`, `src/app/api/orders/track/route.ts:25–65`, bypasses access, uses substring matching for order numbers and phone numbers, accepts arbitrarily short values, and returns the **entire** depth-2 order. A non-numeric order input can normalize to an empty digits string, weakening the substring predicate further. No repository rate limit exists. Client UI hiding fields does not protect returned JSON. `sendOrderAccessEmail:40–48` emails an unprotected order URL, not a signed expiring link.

**Plan:** bind authenticated orders to an immutable customer-account relation, enforce that owner/admin check in the page/data service, and use random expiring scoped tokens for guest access. Tracking should require strict normalized exact identifiers or verified contact/OTP, rate limits, a minimal status/courier DTO, and `private, no-store`; do not return receipt/internal notes/customer address by default. Do not replace a weak phone check with another public email-equality credential alone. **Type: code/schema + tests; complexity M–L; email/OTP costs optional depending on chosen guest-access method.**

### C3 — P0 / critical: untrusted checkout amounts and alternate public creation path

`POST /api/orders:22–93` accepts `subtotal`, `shippingFee`, item `price`, and numeric `codFee` from the request. `computedTotal` adds supplied totals; it does not load current product/variant prices, sale settings, or recalculate shipping. `calculateShipping` is only used by the client and hardcodes fees/threshold instead of using all configured site-setting values. `Orders` has no server pricing hook to compensate.

Additionally, `Orders.access.create` is `() => true` (`src/collections/Orders.ts:28–35`). The registered Payload GraphQL route exposes generated collection mutations, providing a separate order-create entry point governed by this public create permission. The ordinary REST collection POST shares `/api/orders` with the custom handler and must **not** be counted as a second independent REST URL. Fields such as monetary totals, status, orderNumber, notes and proof hashes are not create-restricted at field level. COD status is overwritten to confirmed, but a submitted digital-order status is retained if present (`beforeChange:164–170`). The custom endpoint's digital-proof check is not an invariant of every creation path.

**Impact:** manipulated charges, stale-price purchases, unverified digital orders in fulfillment states, unreliable financial reporting and stock reduction through bypass paths.

**Plan:** one authoritative order command shared by all authorized creation paths; deny generic public collection-create or enforce equivalent field-level/server-hook invariants. Accept product/variant IDs, integer quantities and a checkout token—not prices, status, totals, order numbers, hashes or admin notes. Fetch current published products in a batch, resolve variant IDs, compute active sale/variant price, shipping and COD from authoritative state, snapshot validated amounts in integer PKR/minor units, and return a repricing response requiring confirmation if the displayed price changed. **Type: code/schema + tests; complexity L; no Redis or database migration to another engine needed.**

### C4 — P0 / high: public receipts and unrestricted media intake

`src/collections/Media.ts:23–28` allows unauthenticated create and public read. The same collection holds product assets and `paymentProof.screenshot`. Checkout uploads identifying alt text (`CheckoutPage:77–98`). Public R2 URL generation is not receipt-specific; no private prefix policy, signed-download access or proof owner relation is configured. Public media queries can enumerate metadata under collection read permissions. Actual bucket/domain visibility must be confirmed; with the reported public product-media configuration, receipts cannot be treated as private.

Allowed types include SVG and video (`Media.upload:135–143`). No project-wide upload byte limit, guest-specific MIME/size restriction, receipt ownership check or per-user quota was found. Browser optimizer bounds do not enforce server intake. Installed `storage-s3/dist/generateSignedURL.js:8–25` authorizes any logged-in user by default; registration is public, so direct upload authorization is not admin-only either. The configured signer cannot enforce an application file-size cap that was never set.

**Plan:** split private payment proofs from public catalog media, admin-only catalog uploads, narrowly scoped guest receipt capability, verified MIME/magic bytes, decoded-pixel and byte limits, reject active SVG for untrusted uploads, short upload expiry/quota, safe filenames and orphan expiry. Use a private bucket/location with signed authenticated downloads; an R2 object prefix by itself is not privacy. Review existing receipts and purge unintended public caches after authorization. **Type: code + R2 policy/config + tests; complexity L; existing R2 can be reused, optional scanning/processing cost.**

### C5 — P0 / high: purchase/inventory invariants are incomplete

`validateAndDeductStock`, `src/utilities/inventory.ts:40–99`, reads each product then replaces its entire variants array. There is no conditional update expressing “this specific variant still has at least the requested quantity.” It silently skips a missing product/variants array and silently does nothing when no variant matches. It also omits a publication-status check. Collection relationships may reject a nonexistent product independently, but a valid product with an unknown size can bypass actual deduction. `quantity` has `min: 1` but no integer/custom maximum validation (`Orders.ts:394–399`). The custom order route has no maximum line count.

**Important nuance:** stock reads/writes pass `req`, which is correct for Payload transaction participation. Payload 3.88 initializes create transactions and the Mongo adapter supports sessions. However, installed `db-mongodb/dist/connect.js:56–59` disables them if effective driver options lack `replicaSet`. Atlas has replica sets, but effective SRV/TXT/client configuration was not inspected. With working transactions, conflicting same-product writes can abort rather than oversell. With transactions disabled, read/replace permits lost updates and partial multi-item deductions. There is no explicit whole-command retry/recovery contract for transaction conflicts. Neither outcome has been measured.

`restoreOrderStock:105–156` repeats read/replace. Backorders are clamped at zero on deduction; restoring the entire backordered quantity on cancellation can manufacture sellable stock (for example, an initially zero-stock backorder). Active-order item edits do not reconcile inventory (`Orders.beforeChange:175–193`). Direct admin deletions have no stock-restoration hook. Status changes are not a guarded state machine, and proof-key recomputation uses today's date even during updates.

**Plan:** verify real transaction operation in an isolated Atlas-like replica set; normalize duplicate lines and stable variant IDs; reject unknown/unpublished variants and fractional/unbounded quantities; conditional atomic decrement per variant inside one order/idempotency/inventory transaction; explicit insufficient-stock result; bounded retry only for transient whole-transaction conflicts. Add a stock movement/reservation ledger and transition guard so cancellation/reactivation/item changes restore exactly recorded allocations once. Keep backorder demand distinct from physical stock. Stable SKU uniqueness is not currently configured; define stable variant identifiers and enforce their uniqueness where needed. **Type: code/schema + transactional tests; complexity L; no paid service inherently required, production DB capability verification required.**

### C6 — P0 / high: no checkout idempotency; random order numbers are not retry keys

Neither `POST /api/orders` nor `CheckoutPage.handleSubmitOrder` sends/stores a durable idempotency key. Disabling a submit button does not cover retries, multiple tabs or a response lost after commit. Repeating a valid COD request can create another order and deduct again. Digital `compositeTrxKey` is a date+method+reference uniqueness rule, not a checkout response-replay protocol; an error on retry cannot recover the committed order. Payment-proof hash has an index but not uniqueness, and its preliminary check is race-prone. Some hashes can be absent when the server cannot inspect file bytes.

`Orders.orderNumber.beforeValidate:233–237` uses a six-digit random suffix with a unique constraint, but no collision-retry strategy. Unique indexes prevent duplicate stored numbers, not failed legitimate checkouts.

**Plan:** checkout idempotency key with unique DB constraint and canonical payload hash, atomically committed alongside the order/stock movements; same key+same body returns the original result, same key+different body rejects. Do not expire durable idempotency while an order retry can legitimately occur. Use a collision-resistant internal ID and a separately generated customer-friendly number with bounded collision handling. Preserve payment reference identity across later edits; do not recompute its day from the update timestamp. **Type: code/schema + retry/fault tests; complexity L; MongoDB can own this without Redis.**

## D. Performance findings (ranked by likely impact and confidence)

These are structural costs, **not measured slow-response claims**.

### D1 — High impact / high confidence: public render work and catalog reads on requests

`HomePage`, `ShopPage`, `CategoryPage` and `SalePage` explicitly use `force-dynamic`. Root `(app)/layout.tsx` calls `draftMode()` on all storefront requests. Catalog queries are not wrapped in shared data caches; PDP React `cache` only deduplicates within a render. Shell globals/categories **are** cached and should not be counted as fresh database reads on every hit. This architecture still repeats catalog reads/population and server rendering under popular-link traffic.

**Fix:** measure query/serialization cost, then introduce explicit public catalog DTO caching with complete mutation invalidation (H); isolate preview bypasses and personal session data. Consider native route caching/ISR only after reviewing root dynamic APIs and RSC semantics. Do not simply remove dynamic flags while allowing prices/publication state to remain indefinitely cached. **Code + tests/config, L; native platform cache metering may apply.**

### D2 — High impact / high confidence: dashboard full reads and client-side filtering

`GET /api/admin/dashboard-stats:9–36` uses `find({limit:0,depth:0})` for orders, products and users. In the installed Mongo adapter, `limit:0` disables pagination; it is **not a count-only query** (`db-mongodb/dist/find.js:98–104`). `ensureFirstUserIsAdmin:12` also retrieves all users on every registration to determine whether any exist. The admin orders route loads 500 depth-2 orders before filtering; statistics cover only that window, and “revenue” is not necessarily cash collected. The inventory route stops at 300 products and sale admin data at 200 without pagination.

**Fix:** authorize first; use count/aggregate APIs, date-windowed financial definitions, server-side filters/pagination/projections, per-order details on demand, and an existence query for initial-admin detection. Add a protected first-admin bootstrap procedure so an empty deployment is not publicly raceable. **Code + tests, M; no new service.**

### D3 — Medium–high impact / high confidence: substring search and deep page traversal

`ShopPage:53` bounds query text to 100 characters, but `title contains` remains a substring predicate; a simple B-tree title index does not make arbitrary contains search efficient. `ProductPagination.productPage` allows page 100000; at 50 products/page, deep skip/count/sort work can become expensive even when response size is bounded. Category route accepts but does not apply `q`, so query semantics differ across routes.

**Fix:** define expected search behavior; measure substring plans before choosing normalized prefix search, Mongo text search or Atlas Search supported by the actual tier. Preserve relevance, case handling and language expectations. Bound query lengths/depth and future cache cardinality; defer cursor pagination until catalog size warrants it, with deterministic `_id` tie-break sorting. Align category search behavior. **Code + measured indexes, M; search infrastructure only if justified.**

### D4 — Medium–high impact / high confidence: relationship hydration and response serialization

PDP depth 2 has no product projection. Homepage-global depth 2 hydrates every configured reel relationship/variant, and no maximum reel count is configured. Card projection includes every product image, although a listing uses the first. Admin order lists depth 2 populate product/media/proof relationships across up to 500 documents.

**Fix:** explicit public DTOs, compact image summaries, limit/paginate homepage reels, aggregate admin list data at depth 0, fetch a selected order separately. Record query count and serialized RSC/JSON bytes; do not assume each Payload relationship always causes a separate query because Payload/dependency batching can combine reads. **Code + tests, M; no new infrastructure.**

### D5 — Medium impact / high confidence: inventory round trips and whole-product contention

For N order lines, stock validation performs a size query plus sequential product read/update pairs, repeated again for restoration. Multiple sizes of the same product replace the same product document. This amplifies checkout duration and contention, even if product traffic is otherwise cacheable.

**Fix:** normalize/group lines, batch validation reads, move to conditional variant allocations and bounded writes inside the transaction; measure conflicts and evaluate separate stock records only if whole-product contention persists. Do not introduce unsafe parallel session operations to shorten a transaction. **Code + integrity tests, L; see C5.**

### D6 — Medium impact / high confidence: sitemap scales with the whole catalog per request

`src/app/(app)/sitemap.ts:6–34` is force-dynamic and retrieves all public product/category/page slugs, with projections and depth 0 but pagination disabled. It is not on a typical shopping navigation path, but bots repeatedly triggering a large sitemap can consume shared database capacity.

**Fix:** native cache with product/category/page publication invalidation, paged/chunked sitemap generation before URL limits are reached; preserve canonical origin and failure visibility. **Code + tests, S–M; no extra infrastructure.**

### D7 — Medium impact / high confidence: media CPU, video transfer and intake

`Media.beforeChange` can synchronously read entire files for hashes; Sharp generates original/300/600/1600 WebP variants; video compression invokes `fluent-ffmpeg` if a server temp path exists. No FFmpeg binary is packaged/pinned and no processing timeout is configured. Direct uploads bypass request transfer limits, not automatically all follow-up server processing costs; exact behavior needs staging observation. `HeroSlider.HeroCarousel` creates autoplay video elements for all slides, including offscreen slides. `ShopByVideo.VideoCard` uses viewport playback and `preload=none`, a useful existing optimization, but has no reduced-motion/data-saving gate like the floating PDP video.

**Fix:** server intake limits and private proofs first, small standardized video renditions, pause/defer inactive hero slides, preserve mobile/desktop source selection, benchmark upload CPU/memory. Stream proof hashing where appropriate. Treat FFmpeg as an optional unsupported serverless path until a deliberate processing design is approved; prefer pre-encoding or a separately budgeted job rather than long request-time transcoding. **Code/config, M; optional worker/transcoder costs only after evidence.**

### D8 — Medium reliability impact / high confidence: untracked asynchronous work

`Orders.afterChange:199–218` starts emails with `void ...catch`. They are not durable jobs and can be suspended when a Vercel request ends; the five-second Promise.race in `sendOrderEmails` neither aborts the underlying request nor provides persistence. Hooks execute before the top-level create commits in installed Payload, so an email can be initiated before a later failure/rollback.

**Fix:** transactional Mongo outbox, unique email-event key, retry metadata and a reliable authorized dispatcher after commit. A platform `after`/`waitUntil` improves request-lifetime handling but is not durable recovery. Verify account/reset-email delivery separately: the config imports no active Payload email adapter despite the nodemailer package being installed; custom order emails use Resend explicitly. **Code/schema + worker scheduling, L; email and dispatcher usage may cost money.**

### D9 — Low–medium impact / high confidence: duplicate admin fetching and hidden failures

`OrdersDashboardClient:275–284` invokes `fetchOrders` on initial tab effect and again through initial debounced search. It has no AbortController/request sequence protection against out-of-order results. Sale client timers count down locally; do not misclassify these as per-second database polling. Several admin endpoints return HTTP 200 with zeros/defaults on DB errors. Account history catches errors silently. These obscure failures and distort capacity metrics.

**Fix:** single coherent fetch effect/cancellation, status-specific errors, structured redacted errors with request IDs, explicit partial-report status. **Code + tests, S–M; observability costs optional.**

### D10 — Existing strengths and non-findings

- Installed `payload/dist/index.js:533–642` caches both the initializing promise and initialized instance; repeated `getPayload` calls do not prove new clients per request. Do not add a competing singleton unnecessarily.
- `getDatabaseOptions` already sets Mongo `maxPoolSize=10`, `minPoolSize=0`, idle expiry and bounded connect/selection/wait-queue timeouts (defaults only; deployed values unknown).
- `validate-cart` batches published product IDs, limits input to 100 lines, rejects invalid quantities and fails closed with 503 on query failure. Keep it advisory; it does not replace authoritative purchase validation.
- `ResponsiveImage` uses stored derivative URLs/widths in `srcset`, avoiding Next image re-encoding when candidates exist. Legacy/single-size media uses `next/image`, which can still consume transformation quota. Gallery/lightbox should retain appropriate high-resolution selection.
- `global-not-found.tsx` is independent of Payload; no automatic router refresh/redirect loop is present in inspected 404/error code. Unknown single-segment CMS slugs still need one lookup; multi-segment global fallback is DB-independent. An actual live 404 loop was not reproduced or claimed.
- No recurring storefront sale API polling, custom middleware tax, or active Redis implementation was found. Installed packages alone were not counted as functioning integrations.

## E. MongoDB findings and index plan

### Connections and transactions

`getDatabaseOptions:8–24` and `payload.config.ts:36–75` establish the relevant adapter/pool behavior. Pool size is **per application instance/client and per server topology**, not a global cap. A small pool is already configured; the remaining connection-storm risk comes from concurrent cold instances, deployment overlap, monitoring sockets and replica-set topology. Example only: 40 warm processes each reaching ten application sockets can approach 400 sockets before overhead. That is not a prediction of this deployment.

Plan: co-locate application and Atlas regions, measure warm processes, driver connection checkout wait and total sockets, reserve administrative/rollout headroom, and only then tune `DB_POOL_MAX` (a 3–5 starting test band may be reasonable, not a universal prescription). Never set it to 500 because there are 500 visitors. Ten-second connection/wait defaults bound queues but are not a latency guarantee. Distinguish connection failures from response deadlines; add bounded backpressure rather than blindly retrying all DB calls.

Transaction availability must be tested, including actual rollback of two stock mutations and order creation. Do not disable Mongo transactions for speed. The installed adapter can disable sessions when effective replica-set options are absent; replica-set URI/TXT settings must be inspected by an authorized operator without sharing credentials. No retry behavior configured by driver URI was inspected.

### Existing indexes: what is known

Schema declarations include unique/indexed product slug, category slug, order number and composite transaction key, indexed paymentProofHash/fileHash, and user auth indexing supplied by Payload. Installed Payload automatically adds indexed `createdAt`/`updatedAt` fields (`collections/config/sanitize.js:108–143`). Do **not** propose another bare createdAt index as if none exists.

No project-defined compound indexes or `indexSortableFields` option was found. Product status/isFeatured/basePrice/title and category query fields do not declare dedicated compound access paths. This confirms **missing declarations for these query shapes**, not the absence of manually created production indexes. Actual `listIndexes`, query plans, document distribution and storage were not accessed. Installed Mongo connect defaults to automatic index creation; assess controlled index deployment before cold-start/index work becomes a bottleneck.

### Candidate indexes, in implementation order after plan evidence

1. **Published listing sort:** candidate `{ status: 1, title: 1, _id: 1 }` for `/shop` default published/title sort. Benefit: filters/sorts without a full in-memory sort; tie-break must also be adopted in the query. Cost: one entry per product and extra title/status write maintenance. Verify against existing indexes, collation and scan/returned ratio before creating.
2. **Featured home:** candidate `{ status: 1, isFeatured: 1, createdAt: -1, _id: -1 }` for `HomePage`’s exact filter/sort/limit-8. Benefit depends on catalog size and feature selectivity. One per-product index; writes to feature/status update it. Consider a smaller partial published-featured index if the actual planner/predicate supports it, not both by default.
3. **Category branches:** assess separate `{ status: 1, primaryCategory: 1, title: 1 }` and `{ status: 1, categories: 1, title: 1 }` for the two OR branches. `categories` is an array, so that index is multikey, increases entries/storage with assignments and may not eliminate all sorts under multi-category `$in`. Do not combine multiple independent arrays in one compound index. Explain the actual OR/subcategory query; choose at most the demonstrated useful access paths.
4. **Price sort:** `{ status: 1, basePricePKR: 1, _id: 1 }` only if price sorting is common/slow after steps 1–3. It adds cost to every price change and does not fix unanchored substring search. Reverse direction may serve both price orders when all sort directions match.
5. **Admin order history:** candidate `{ status: 1, createdAt: -1, _id: -1 }` after server-side status/date pagination exists. The present JS filter must be removed first. Date-wide totals may use a different existing timestamp index or aggregation—measure before adding another.
6. **Owner history:** introduce an authenticated `customerAccount` relationship, then assess `{ customerAccount: 1, createdAt: -1, _id: -1 }`. Do not index `customer` as a user relation today: it is a delivery-information group. Email matches are not a trustworthy ownership model without verified linkage.
7. **Correctness constraints:** a unique order idempotency key, stable variant identity constraint in the chosen stock model, and unique outbox event IDs are needed when those features are implemented. These are not performance-only indexes. Determine null/sparse/partial semantics and handle existing data before enabling uniqueness.

For every candidate: inspect actual indexes, capture `explain` on staging with realistic cardinality, compare keys/documents examined, blocking sorts, latency and write cost, then assess index bytes against the Atlas storage budget. Avoid adding every candidate to a four-product catalog immediately. Do not make `paymentProofHash` globally unique without defining whether duplicate receipts legitimately fund multiple orders; hash uniqueness is not payment confirmation.

Other query improvements: replace `limit:0` dashboard/bootstrap reads with count/existence/aggregate; project only needed fields; count filtered listings only when the UX requires exact totals; batch size/product lookups during checkout; avoid whole-catalog scans for every sale dashboard request. Exact counts can add real work even with paginated results.

## F. Ecommerce integrity review

### Current lifecycle and failure cases

- **Add-to-cart:** local browser state; advisory stock snapshots. No reservation or authoritative price commitment occurs.
- **Checkout:** optional live-stock precheck from the cart drawer. The order POST can be invoked independently, accepts financial values, and does not establish a trusted customer-account link.
- **COD:** Orders hook sets confirmed and deducts stock before completion of create. Confirmation is an order state, not money collected.
- **Digital transfer:** reference/screenshot submitted; the code does not verify a bank/wallet transfer. Stock is deducted while pending verification, with no expiration/release worker. Unpaid/spam orders can therefore tie up inventory.
- **Fulfillment:** admin status updates are not a validated lifecycle transition machine; cancellation restores, cancelled-to-active deducts again. Changes can happen through generic admin collection APIs as well as the custom API.
- **Notifications:** unawaited emails, not a durable committed-event delivery system.

**Last unit / simultaneous stock edits:** insufficient stock on a single observed snapshot throws; stale read/replace remains a conditional concurrency risk. Transactions can turn this into a conflict failure; prove that behavior and return a correct retryable response. Conditional matched-count checks and atomic allocations are still recommended.

**Duplicate click, network retry, timeout after commit:** no checkout idempotency/recovery; duplicate COD order possible. A generic 500/400 does not tell the client whether a commit succeeded. Durable key lookup must recover the same result, with no second stock decrement.

**Unmatched size/draft item/fractional quantities:** insufficient purchase-command invariants, even though the separate validation route is more restrictive. Reject at the final command, not only in UI.

**Backorder cancellation / edited lines:** current clamp-and-restore logic cannot represent exact physical stock allocations. Record committed allocated quantity versus unfilled demand; never restore unallocated units. Restrict active order edits or perform explicit compensating movements in one transaction.

**Partial failure:** with working shared transactions, stock/order rollback can be coherent; with transactions disabled, multi-line stock writes may persist before create fails. Proof lookup queries do not consistently pass `req`, so uniqueness must be database-enforced where required. The code does not implement compensating repair/outbox reconciliation.

**Stale price / expired promotion:** no authoritative recomputation. `getSalePriceDetails` checks campaign bounds, but only sale display uses it; PDP/normal listing/cart/checkout do not share a consistent sale quote. A zero variant override is treated differently by `getSalePriceDetails` (>0) and PDP’s nullish override. Unify pricing, rounding, zero-price policy, shipping settings and price snapshots. No coupon implementation was found, so coupon validation cannot be certified; do not add coupon acceptance without server validation.

**Duplicate reference / screenshot:** composite reference uniqueness is a useful existing guard but scopes by date/method, not by trusted payment provider transaction identity; it cannot establish receipt authenticity. During updates it uses the current date, risking identity drift. Hash checks can race or lack a trusted hash; UI `readOnly` is not field-level access protection.

**Payment webhook duplication, capture-success/app-timeout, captured-but-order-unupdated:** not current processor failure paths because there is no gateway capture/webhook implementation. If one is introduced, require raw-body signature validation, unique provider event/payment IDs, amount/currency verification, durable inbox and transactional monotonic state transitions, plus reconciliation of unresolved captures. Never mark an order paid from browser redirects or proof images. Do not describe manual transfers as automatically confirmed payments.

**Customer history:** `Orders.read=adminOnly` conflicts with the authenticated history page’s `overrideAccess:false`; customer errors are swallowed as “no orders.” Address history additionally queries `customer=user.id`, but customer is a group, not a relationship, and address UI/form components are currently stubs returning null. Fix ownership/feature completeness together; do not weaken access to make history appear.

## G. Redis recommendation

**Verdict: Redis is unnecessary until measurements demonstrate a bottleneck after correctness, queries and native caching are addressed.**

There is no existing Redis dependency/implementation to preserve. The app already has Next Data Cache for shell content and a reusable Payload client; Redis is not needed for client-local carts or for reliable MongoDB idempotency/stock transactions. A second shared catalog cache layered over Next caching may add cost/invalidation complexity without reducing further work.

Compare the actual choices:

- **MongoDB/query optimization:** first for price/stock correctness, count/existence reads, projections and supported indexes. Lowest operating complexity; additional indexes consume storage/writes.
- **Vercel/framework Data Cache:** first shared public catalog cache to evaluate. Explicit data caches can reduce DB work even while a route remains dynamic; they do not by themselves remove all function/render invocations. Region-aware latency and cache quotas require measurement. Complete product invalidation is a prerequisite.
- **Vercel native public page/ISR caching:** a later option to remove eligible origin render work after dynamic preview/auth boundaries are correct. Prefer framework-integrated RSC-aware caching over a blanket CDN HTML override.
- **Cloudflare:** strongest immediate fit is versioned public image/video/static content, using a proxied custom R2 domain and intentional cache headers. It is not automatically an HTML/API cache because it is the DNS provider. Private proof/account/checkout/admin responses must bypass it.
- **In-process cache:** useful only for short request coalescing and initialized clients. Serverless instance eviction, independent processes and deployments make it unsuitable as authoritative stock/rate-limit/idempotency state or reliable global invalidation.
- **Managed Redis:** reconsider for measured cross-instance hot public queries that native caching cannot meet, a justified shared rate-limit service, or cross-service cache access. Rate-limit architecture can have a separate justification from catalog caching; do not leave P0 APIs open while waiting for Redis.

If Redis later wins a benchmark:

1. REST-based client with reusable configuration is suitable for ephemeral functions; alternatively one pooled TLS client per warm process, never per request. Budget connections across the fleet and do not expose credentials to browser bundles.
2. Use public DTO keys from H; canonicalize/default/bound query dimensions; no PII/session credentials. Keep search short-lived or uncached to avoid unbounded low-hit-rate keys.
3. Hypothesize 90–95% hit rate only for repeated popular keys; measure the distribution. If a miss needs 4 DB operations and hit ratio is 95%, 25 cacheable requests/sec would average about 5 DB operations/sec for that component, not counting auth/writes/cache fills. This is arithmetic, not an observed result.
4. Cache-aside with bounded timeouts, circuit breaking, limited fallback concurrency, short single-flight per key and optional leased cross-instance fill locks. A failed catalog cache must degrade to bounded Mongo reads or a truthful 503, not an uncontrolled miss stampede. Locks do not enforce inventory correctness.
5. TTL jitter and controlled warming reduce synchronized expiry; generations/tags with durable invalidation events prevent old in-flight fills resurrecting stale products. Measure Redis serialization and network RTT against direct indexed DB queries before adoption; select a region near Vercel/Atlas.
6. Small JSON DTOs only; bound records/key count, monitor key overhead, TTL distribution, hit/miss rate, evictions, errors and quota. Illustrative 2,000 records × 20 KiB is ~39 MiB of raw payload before metadata/allocator overhead; estimate from measured serialized bytes instead of sizing to catalog count alone.
7. Redis downtime must not permit unvalidated purchases or leak private state. Eviction/TTL must never erase the only copy of an order, reservation, payment or idempotency record. Outbox/checkout authority remains MongoDB.

One candidate, **not an adoption recommendation**, is Upstash. Its current pricing lists Free: 256 MB, 500K commands/month, 10 GB monthly bandwidth; PAYG commands are $0.20/100K with separate storage/bandwidth terms. At 25 GETs/sec sustained, 500K commands lasts roughly 5.6 hours before writes/locks/rate-limit commands. Thus “free” is not an unlimited spike plan. Confirm actual account quotas because older provider FAQ limits differ. [Pricing](https://upstash.com/pricing/redis).

The provider documents 10K concurrent connections in its limits announcement; REST avoids maintaining app-side TCP Redis connections. Persistence is enabled, but Free lacks the additional replica redundancy described for paid databases; do not infer a paid uptime SLA. Eviction defaults off (writes reject at capacity); optional cache eviction uses the provider’s optimistic-volatile policy. These are operational constraints, not a transactional guarantee. [Connection limits](https://upstash.com/blog/limits-increase), [REST troubleshooting](https://upstash.com/docs/redis/troubleshooting/max_concurrent_connections), [durability](https://upstash.com/docs/redis/features/durability), [eviction](https://upstash.com/docs/redis/features/eviction).

## H. Proposed cache design and freshness matrix

**Not implemented.** Each matrix entry below names owner/source, key, TTL, invalidation, acceptable staleness and failure behavior. Data-cache TTL is not the same as a strict maximum staleness: background revalidation can serve stale data past TTL. Hard age/version checks and synchronous expire/invalidation are needed for strict bounds. For publication/privacy removal, fail closed rather than indefinitely serving stale content.

### Shared key rules and invalidation protocol

Use a namespace such as `nski:prod:v1`; isolate preview/staging/deploy-schema versions. Public dimensions are canonical category-branch identity, normalized filters/search, allowlisted sort, page and page size, locale `en-PK` and currency `PKR` (currently not user-selectable; make explicit before extending). Omit irrelevant tracking parameters from cache identity. Query cardinality, page depth and search length must be bounded. Never include a user session in a “public” cache and never share customer/order JSON under only an order/product URL.

Before caching products, add coordinated after-change/delete invalidation for products, categories, media, homepage and sale settings. Capture **old and new** slug/category/featured/publication/video eligibility; invalidate old/new PDP keys, all affected category ancestors, relevant home/sale/list keys and sitemap. Price changes must invalidate every surface showing that price. Category reparent/slug changes invalidate the hierarchy and both old/new branches. Media replacement invalidates old URLs or changes object keys. Sale changes invalidate pricing dependencies, and cache lifetime must respect campaign start/end boundaries.

Current `storefrontCachePlugin` invalidates `storefront-shell` for categories and all globals, but not ordinary product changes. Auto-sync can incidentally update the homepage global for reel products, which is not a complete product invalidation strategy. Most public products are currently uncached, so missing product invalidation is a **prerequisite gap for new caching**, not proof that a nonexistent catalog cache is stale today.

Hooks run before a surrounding transaction has necessarily committed. Immediate invalidation can let another request refill old committed data before the change commits. Proposed solution: commit durable invalidation/outbox events with the change, process after commit, then invalidate cache generations/tags, coordinate fills and acknowledge completion. Verify or bypass the cache when a critical unpublish/privacy invalidation is pending. Monitor retries/dead-letter events. TTL is only a fallback, not the sole correctness mechanism.

### Matrix entries

1. **Navigation/category hierarchy.** Owner: CMS categories. Current `storefront-categories`; proposed `nski:prod:v1:categories:en-PK`. TTL 60s. Invalidate category create/update/delete/reparent. Maximum acceptable ordinary label/tree age: 60s; sensitive removals require acknowledged invalidation. On fill failure: bounded last-known-safe copy only if age policy permits, otherwise render explicit fallback/no navigation; report failure. Redis not required.
2. **Header/footer/site display settings.** Owner: CMS globals. Current `public-global:{slug}:{depth}`; proposed namespace plus slug/depth/locale. TTL 60s. Invalidate specific global after commit; retain broader shell tag only as needed. Ordinary copy age 60s; checkout’s authoritative fees are never taken from this display cache. Failure: safe display defaults where explicitly permitted; payment destination information must not fall back to placeholder banking details. Existing null catches/default placeholders need a separate fail-closed checkout policy.
3. **Homepage featured/reels DTO.** Owner: products + homepage + referenced public media. Key `...:home:en-PK:PKR:{catalogGeneration}:{saleGeneration}`. TTL 60s. Invalidate feature/status/category/price/media/reel changes and home edits. Price/copy age ≤60s under hard age policy; unpublish waits for invalidation/bypasses. Failure: bounded DB fallback, no accidental inclusion of drafts. Exclude authoritative stock; shared cache only public data.
4. **Category/all-product listings.** Owner: products/categories. Key `...:list:{branch}:{filtersHash}:{sort}:{page}:50:en-PK:PKR:{generation}`. TTL 30–60s, initially 30s. Invalidate product create/delete/publication/category/price/title/image changes plus category ancestry changes; generation-based invalidation avoids enumerating every filter key. Display age ≤30s initially. Failure: bounded indexed query or truthful 503, not old indefinite data. No customer-specific discounts or cart state.
5. **PDP public content/price DTO.** Owner: product + public media + sale policy. Key `...:product:{id-or-slug}:en-PK:PKR:{productVersion}:{saleGeneration}`. TTL 30s initially; invalidation on any displayed product/media/price/status/slug change. Hard display-age target ≤30s, immediate acknowledged unpublish. Preview bypasses read/write cache. Separate live stock hints if required; purchase recalculates authoritative price and stock every time. Failure: bounded source read or unavailable page; never retain deleted products indefinitely.
6. **Sale display/pricing metadata.** Owner: sale-settings. Key `...:sale:{campaignVersion}:en-PK:PKR`. TTL at most 30s and no longer than the next start/end boundary; evaluate dates on request using current time. Invalidate campaign/date/target/discount changes and affected catalog keys. Acceptable schedule boundary staleness: zero for the authoritative quote, ≤30s display only. Cache failure: source read, otherwise clearly unavailable offer—not an invented discount or silent financial default.
7. **Search results.** Initially do not cache arbitrary search. If justified, key `...:search:{normalizedTermHash}:{filtersHash}:{sort}:{page}:en-PK:PKR:{generation}`, TTL 15s, strict term/key quotas and short negative-result TTL. Owner: products/catalog generation; same product triggers. Maximum display age 15s. Failure: bounded search query with limits or retryable error. A low hit rate can make Redis slower/more expensive than uncached indexed search.
8. **Sitemap.** Owner: published product/category/page slugs. Key `...:sitemap:{chunk}:{publicContentGeneration}`. TTL 300s initially; invalidate public slug/publication/create/delete and category/page changes. Maximum age 5 minutes, with acknowledged removal invalidation for urgent cases. Failure: retain only age-bounded known public XML or retryable failure; chunk before large catalogs. Public cache eligible only for this non-personalized response.
9. **Authenticated/admin/account/checkout/tracking/proof/API responses.** Owner: authoritative MongoDB and private R2. **No shared public cache key or TTL.** Use `Cache-Control: private, no-store`; bypass Cloudflare/Vercel response caches. Every read requires authorization; every write validates authoritative state. Stock/pricing/order/payment states are never accepted from a public cache. Admin reporting may later use a strictly authorized short-lived aggregate cache keyed by tenant/date/filter/version, not unprotected customer documents.
10. **Public versioned assets.** Owner: R2/static build output. Key: immutable content-hashed object URL/Next build asset path, not cookie identity. Proposed `public, max-age=31536000, immutable` only where bytes truly never change at that URL. Mutable legacy filenames get shorter revalidation TTL (start 300s) or are migrated to versioned URLs; overwrite/delete requires purge. Private receipts get no public asset rule. If R2/CDN fails, media may show a fallback; shopping/payment security must not be bypassed.

### Cloudflare/Vercel response policy

The repository does not define live Cloudflare rules, R2 object cache-control metadata, an apex↔www redirect, or application security/cache headers in `next.config.ts`. `SITE_ORIGIN` is the apex, while the supplied storefront URL is www. Verify one permanent canonical redirect preserving path/query, TLS mode/certificates, proxied DNS state and no loops. Do not infer these settings from Cloudflare DNS usage alone.

Cloudflare does not cache HTML/JSON by default; public R2 caching needs a configured custom domain. Versioned catalog images/video/static JS/CSS are the safest cache candidates. [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/), [R2 cache integration](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/).

Do not add “Cache Everything” across the application. Bypass `/api/**`, `/store-admin/**`, `/account/**`, `/orders/**`, `/checkout/**`, tracking/guest-access routes, authenticated requests and preview cookies. If public HTML caching is later approved, account for Next RSC/prefetch headers/query variants, cookies, redirects, `Set-Cookie`, preview and route invalidation; native framework caching is preferable. A cached HTML version must not be substituted for an RSC response.

For a separately verified public DTO API, a starting response policy could be browser `max-age=0` with an edge `s-maxage=30`, no credentials/cookies and complete invalidation. Do not apply it to existing admin/order APIs. Observe `CF-Cache-Status`, `Age`, Vercel cache status and browser network bytes in authorized staging; none was sampled from production. Verify R2 CORS allows only needed upload origins/methods/headers, video range requests and signed URL expiry. CORS is not authentication.

## I. Free-tier capacity and cost assessment

### Verified documentation, not verified account entitlements

**Vercel:** current Hobby documentation restricts use to non-commercial personal projects. It lists 1M function invocations, 4 active CPU hours, 360 GB-hours provisioned memory, 100 GB fast data transfer and 5K image transformations among included allowances. Hitting limits can pause features. These are quotas, not measured throughput. A production trading store should use an eligible plan; this policy issue cannot be solved with caching. [Hobby policy and allowances](https://vercel.com/docs/plans/hobby).

With Fluid Compute, the functions documentation lists Hobby’s 300s maximum, 2 GB memory and a 4.5 MB request/response payload limit; defaults differ from legacy configurations, so verify this project’s Fluid setting. Even a platform concurrency ceiling says nothing about Atlas throughput or checkout correctness. Repository serverActions’ 70 MB setting does not override a hosting request cap. [Functions limits](https://vercel.com/docs/functions/limitations).

Vercel Pro currently starts at $20/month with a $20 usage credit and additional usage/seat charges; it is not an unlimited fixed-price traffic guarantee. Review pricing, region-specific usage and spend alerts before changing plan. No plan change was made. [Pro](https://vercel.com/docs/plans/pro-plan).

**Atlas Free/M0:** current documentation lists 500 connections, 100 read/write operations/sec, 0.5 GB documents-plus-indexes, 10 GB ingress and 10 GB egress per rolling seven days, and a 32 MB in-memory sort limit. It documents throttling and limited observability (connections, size, network and opscounter; not all requested CPU/profiler views). These numbers do not mean 500 concurrent shoppers or 100 HTTP requests/sec. Actual account tier, headroom, database version, indexes and effective replica-set configuration require authorized verification. [Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

**Cloudflare/R2:** no assumption that the DNS/CDN plan caches all traffic or that R2 operation/storage consumption is zero. Existing derivatives reduce transfer size but multiply stored objects/upload work. No configured storage bytes, asset hit rate, egress path, bucket policies or account quota was accessed. Media size/operation counts and actual chosen-plan pricing must be checked before cost forecasting. Versioned-object caching and private-proof separation take precedence over adding services.

**Redis:** not currently a cost. Candidate free/PAYG limits and availability restrictions are in G. Do not introduce it solely because an unrelated free-tier marketing claim sounds generous.

### Workload assumptions and illustrative capacity arithmetic

Record: active fraction of 500 sessions; session lifetime/arrival rate; page views per session; dwell/think time; mix of home/list/PDP/search/account; navigation prefetch and RSC requests; cold/warm origin instances; browser asset cache hit rates; video bytes; product/variant/category/reel cardinality; auth frequency; cart size; checkout conversion/retry rate; campaign hotspot distribution; geographic RTT; admin activity and bot traffic.

For a closed browsing model, average page actions/sec ≈ `active users / (think time + response time)`. With 500 active users, 20s think time and 0.5s response time, that is about **24.4 page actions/sec**, not 500 RPS. Initial assets/auth/prefetch are additional requests. If each uncached action triggers four DB operations, that component is about **97.6 operations/sec** before other traffic. Four is an illustrative assumption, not a measured Payload operation count. A 10s think-time model roughly doubles the load.

Data-cache hits can reduce database operations but still require SSR invocations. Public full-route/CDN hits can remove origin requests only if those responses are truly cacheable. Media goes to its own host but may dominate user-perceived speed. Use measured query and serialization traces rather than mapping one page request to one DB operation.

**Capacity verdict: unproven.** Neither support nor failure at 500 concurrent users can be certified from source. Needed measurements: section K, actual provider entitlements/settings, catalog/traffic distribution, p95/p99 latency, operation rate, peak connections and throttling, memory/CPU where exposed, and checkout invariants. Address the Hobby commercial-use restriction regardless of the result.

## J. Prioritized remediation plan

Effort bands: S ≈ half–1 engineer day; M ≈ 1–3 days; L ≈ 3–7 days. These are planning estimates including targeted tests, not commitments; overlapping tasks should be scoped together. No work below is authorized by this report alone.

### P0 — correctness, privacy, security and critical reliability

1. **Protect custom administration APIs (C1).** Code/test M; no new infra. Include all methods, customer/guest denial, legitimate admin allow, bounded batches and no-store. Highest immediate priority.
2. **Close order/receipt disclosure paths (C2/C4).** Owner/guest capability model plus private media code/schema/R2 config L; existing storage usable, optional OTP/scanner costs. Review historical exposure only with separate permission; no history/production data review occurred here.
3. **Authoritative checkout and restricted generic creation (C3).** Code/schema L; no Redis cost. Server-only prices, stock eligibility, shipping/discounts and writable-field allowlists. Remove placeholder payment destinations when settings fail.
4. **Idempotent transactional order/inventory service (C5/C6).** Code/schema + isolated replica-set tests L; includes allocations, backorder/cancellation reconciliation, retries/conflicts and stable reference/order identity. No inherent need to upgrade MongoDB, but effective transactions must be verified and tests need isolated staging resources.
5. **Bound abuse at all public command/upload routes.** Code/config M; body/string/line/quantity/byte/pixel limits, trusted upload capability, origin checks and layered rate limiting. Start with available hosting/Cloudflare controls; inspect bypass through Vercel’s default domain and do not rely only on in-memory counters. Shared limiter cost only if needed/approved; never use an outage-open limiter as purchase authorization.
6. **Eligible production hosting and operational safety.** Account/config S plus commercial plan cost; owner verifies Hobby eligibility, production runtime, region, backup/restore and secrets management. No changes without authorization.
7. **Reliable post-commit order notifications (D8).** Code/schema/dispatcher L; Mongo outbox plus bounded retries and delivery visibility. Provider email/dispatch usage may cost; do not make an external email failure roll back a valid committed purchase.

### P1 — high-impact performance and functional fixes

8. **Counts/aggregates and paginated admin DTOs (D2/D4).** Code M; no new service. Correct revenue definition, remove 500/300/200 truncation and user-registration full scans.
9. **Measured catalog query/index improvements (D3/E).** Code/index M; storage/write overhead, no index created during audit. Verify actual index plans before selecting the smallest useful set.
10. **Preview authorization, published access and account consistency.** Code/test M; no infra. Preview currently stores the whole `payload.auth` result in `user`, so `if (!user)` checks the wrapper rather than `result.user` (`next/preview/route.ts:35–57`). Require an authenticated authorized admin, validate local redirect (reject protocol-relative paths), and keep draft bypass out of public caches. `Products.read=()=>true` currently exposes drafts through generated collection APIs; published filters on storefront pages do not fix that. Fix customer-account linkage/history/addresses without broadening public order access. Archive/Carousel CMS blocks also lack published filters and bypass by default; usage by live CMS content is unverified.
11. **Unified pricing/shipping display and confirmation semantics.** Code/test M; no infra. Resolve sale/PDP/cart differences, integer money/quantities, zero override policy, and the confirmation page that always says pending verification despite COD confirmed. Distinguish received, verified payment, fulfilled and collected revenue.
12. **Media and fetch cleanup (D7/D9).** Code/config M; no recurring cost unless a transcoder is later chosen. Defer inactive videos, bound processing, prevent duplicate admin fetch/stale responses, redact error/email logging and escape customer-supplied HTML in email templates (`emailTemplates.ts:124,185–188,251–259`); validate courier URLs/schemes before interpolation.

### P2 — caching and architecture

13. **Committed product/cache invalidation foundation (H).** Code/schema L; uses existing Mongo/Next, worker may add usage. Old/new slugs/categories/ancestors, prices, media, publication and campaign boundaries; replayable events and failure alarms.
14. **Public DTO Data Cache + sitemap cache (D1/D6/H).** Code/test M–L; framework cache metering possible. Start with hot home/PDP/first category pages; measure DB reduction. Strict preview/auth/private bypass and hard-age policies before rollout.
15. **R2/static CDN metadata and canonical host review (H).** Config/test M; existing Cloudflare/R2 plans may suffice; account-specific feature costs to confirm. Versioned public assets, no public proof caching, correct range/CORS and no broad HTML cache rule.
16. **Redis decision checkpoint (G).** Benchmark/design S–M; $0 recurring until approved. Adopt only if native cache/index results or a separate distributed-limiter requirement justify added service cost/operations.

### P3 — observability, release gates and scaling

17. **Request tracing/metrics and redacted logs.** Code/config M; free telemetry first, retention/paid monitoring optional. Tag route, query count/duration, transaction conflicts, cache hit/age, response bytes, connection waits, outbox backlog, retries and duplicate-key outcomes; never log addresses, proofs, raw tokens or full request bodies. Email utilities currently log recipient addresses and route handlers can return raw error messages.
18. **Reproducible CI and isolated test environments.** Code/config M; CI minutes/storage costs depend on provider. Resolve Node/package-manager lock alignment; TypeScript, lint, mock/unit, isolated browser and replica-set transaction tests as separate gates. No `.github` workflow directory found. Fix existing lint debt, not by disabling important checks indiscriminately.
19. **Capacity and failure tests (K).** Test harness/data M–L; staging/load generator/provider usage costs need approval. Abort controls and artificial emails/payments only. Upgrade Atlas based on sustained throttling/working-set/availability needs, not an assumption Redis or a database migration is required.

## K. Safe staging load-test plan

**Design only; no test run.** Explicit approval, spend budget and an isolated staging deployment/database/bucket/email sink are prerequisites. Do not start a dev server or default E2E suite that might load the shared production `.env`. Use synthetic data with a distinct environment identifier; disable production mail and use test payment credentials only if a gateway exists later. Environment-gate any cleanup, administrative mutation or reservation test.

### Tools and preparation

After approval choose k6 or an equivalent open tool; no dependency was installed. Generate realistic catalog volumes (current small catalog and anticipated 1K/10K products), variant/category distributions, large image metadata, and a separate hot-item stock pool. Reuse isolated test customers and unique idempotency keys. HTTP load tests do not download/render video, execute localStorage carts or reproduce browser LCP: add a small real-browser cohort for navigation, responsive media, add-to-cart and Core Web Vitals. Model RSC/link-prefetch traffic separately from plain HTML; verify the chosen path hits origin rather than silently benchmarking only CDN.

Use approved staging domains as an allowlist with a production denylist. Verify database/storage/payment/email environment identity before writes. Never point mutation scripts at production or assume a preview deploy uses a separate database. Tag all generated entities for owner-approved cleanup; no real customer inventory/payments.

### Profiles

1. **Baseline/cold:** 1, 5 and 10 virtual users; new-deploy cold initialization and warm repeated URLs. Measure per-route query count, payload size and cache behavior.
2. **Browse ramp:** 25 → 50 → 100 → 250 → 500 VUs, 3–5 minutes per stage, with randomized 10–30s think times. Start with action mix 45% PDP, 30% listing/category, 15% home, 10% search/filter/sort; replace with real analytics later. Use both popular repeated URLs and long-tail keys. Stagger initial loads so 500 session auth lookups are not unintentionally simultaneous unless explicitly testing a launch burst.
3. **Warm peak:** hold 500 VUs for 15–30 minutes only after previous stages pass and budgets permit. Repeat separately with cold/invalidated caches and an open-loop arrival-rate profile so rising response times do not hide overload by slowing the closed-loop VUs.
4. **Cart/checkout subset:** about 10–20% browse actions add/update/remove cart locally, not 100% server requests. Select an explicitly small, independently capped synthetic checkout rate (initially 1 write/sec) for COD/manual-proof test orders; cart size distribution 1–5 lines, duplicate-line inputs, stale/invalid variants, expired promotions and retries. Adjust from actual conversion data; do not model every VU as a purchaser.
5. **Hot inventory correctness:** isolated tests of 2/10/50 simultaneous attempts against one unit; multi-variant/same-product updates; disjoint products; duplicate keys/same-body replay; same key/different body; timeouts immediately before/after commit; transient transaction abort; cancelled/reactivated/edited orders; backorder cancellation. Assert committed ledger, stock and accepted orders, not only HTTP success counts.
6. **Recovery:** cache timeout/unavailability, controlled DB interruption in an environment that permits it, upload failure, email sink failure and dispatcher restart, duplicated/out-of-order invalidation events. No Atlas Free failover simulation assumed; provider capability may restrict fault injection.
7. **Authorized admin overlap:** small operator cohort doing paginated reports/status edits alongside browse load. Validate denied guest/customer access without enumerating real data.

### Metrics and provisional acceptance gates

Capture per-route HTTP/RSC requests/sec, p50/p95/p99 and timeout/4xx/5xx rates; distinguish expected validation/stock 4xx/409 from unexpected failures. Capture TTFB and browser LCP/INP/CLS with device/network assumptions; body/RSC/image/video bytes and cached/uncached asset requests.

At application/DB level: function duration, active CPU/memory and cold starts where available; query count/latency, transaction aborts/retries, pool wait/connect times, active DB connections, opscounter/network/storage and throttling. CPU/memory and profiler detail are not all available on M0; supplement with application timings or explicitly budget a representative instrumented tier. If Redis is later added: RTT, hit/miss, fills/lock waits, memory, eviction, errors and quota. Measure checkout commit rate, duplicate order count, stock allocations, outbox/invalidation backlog and eventual notification delivery.

Starting targets, **not claims or contractual SLAs**:

- Warm public browse/search p95 ≤1s and p99 ≤2s server response; track cache-miss routes separately. Cold-start behavior must meet an agreed launch target, initially ≤3s p95 under the staging geography.
- Checkout p95 ≤2s, p99 ≤5s excluding user think time/external manual transfer; explain any legitimate transaction retry.
- Unexpected 5xx/timeouts <0.5%, zero sustained queue growth; expected sold-out/invalid-input responses are correct results, not successful purchases.
- Zero duplicate committed orders for identical idempotency keys, zero non-backorder oversells/negative stock, zero restoration of unallocated units, and zero authorization/privacy violations. All-or-nothing multi-line rollback and timeout-after-commit replay must pass.
- Measured workload retains at least ~30% connection/operation budget headroom as a starting target, with no throttling. Do not extrapolate a raw 100 ops/sec provider threshold into an HTTP SLA.
- At least 90% hit rate on the intentionally repeated cacheable subset after warm-up is an initial hypothesis; report long-tail and aggregate hit rates separately. No stale publication/private data, and observed display ages/invalidation latency within H’s approved bounds.
- Outbox work is recovered after restart and drained within an agreed window (initial target 60s); no misleading HTTP 200 success on a failed report/dependency.

Stop a stage for inventory/privacy invariant failure, prolonged throttling, unexpected failures >2% for 60s, p95 >5s for 2 minutes, connection budget alarm or spend limit. Establish emergency stop and authorized operator before running. Adjust numerical gates after a clean baseline, actual conversion/traffic and customer expectations; never relax correctness/privacy gates for speed.

## L. Implementation sequence and validation gates

1. **Freeze the audited baseline and define staging credentials/resources.** Validate environment identity without exposing secrets; confirm commercial hosting eligibility, regions and backups. Approval required before account changes or staging spend.
2. **Authorization/privacy patch first.** Guest/customer/admin endpoint matrix, owned/unowned order tests, minimal tracking responses and private receipt checks. Verify GET/POST/REST/GraphQL/server-action variants; UI-only tests are insufficient.
3. **One authoritative checkout command.** Tampered price/fees/status, negative/fractional/oversized quantities, unknown variant/draft product, campaign boundary and missing settings tests. Generic create must not bypass the service.
4. **Transaction + idempotency + movement ledger.** Real Mongo replica-set races and fault injection; assert last-unit behavior, rollback, cancellation/backorders, replay result and number collision handling. Do not use only mocked Payload update calls as evidence.
5. **Durable post-commit events.** Outbox crash/retry, duplicate email/invalidation events, missing external services and pre-commit rollback tests. Verify receipt lifecycle and account history.
6. **Admin query and catalog index/projection improvements.** Capture before/after query plans, actual returned bytes and realistic dataset correctness. No “fix” that hides older orders or reports inaccurate revenue.
7. **Complete invalidation before catalog caches.** Old/new slug/category/media/price/status tests, concurrent refill races, failed invalidation and sale boundaries. Then cache hot public DTOs and sitemap, measuring DB load and freshness.
8. **CDN/static media policy and page-cache eligibility.** Authorized staging headers, cookies, RSC variants, signed private downloads, canonical redirects, uploads and range/video checks. No broad public caching of private routes.
9. **Read-heavy ramp then isolated write/hot-item tests.** Compare cold/warm runs and realistic action rates; record saturation/error knees and budget. Run real-browser UX checks separately.
10. **Decide scaling spend from measurements.** Eligible Vercel plan is a commercial-policy need; Atlas upgrade depends on actual limits/working set/availability. Reconsider Redis only at the explicit G checkpoint. Repeat tests after any infrastructure change.
11. **Controlled release and rollback.** Gradual traffic, freshness/privacy/inventory alarms, durable event draining and clear owner sign-off. Do not deploy caches or stock-schema changes without backwards-compatible rollout/recovery plans.

## M. Open questions, coverage and evidence boundaries

### Required owner/operator information

- Which commit is deployed, which Node version, Vercel plan/Fluid Compute configuration, function region/concurrency controls, monthly usage and spend settings?
- Atlas exact tier/region/version, effective replica-set/driver options, connection/operation/storage headroom, actual indexes, backup/restore policy and any indexes created outside code? No URI or password should be pasted into chat.
- Cloudflare proxied records, apex/www redirect owner, TLS mode, WAF/cache rules, Vercel default-domain bypass controls, R2 custom/public domains, object metadata, CORS and receipt bucket visibility? DNS/CDN account settings are not in the repo.
- Are order lookup links intended for guests, and what guest verification/expiration UX is acceptable? Are customer emails verified before account-order linkage? Who may inspect payment receipts and for how long?
- When should COD or pending-transfer stock expire/release? Are backorders allowed to create procurement demand? How should edits/cancellation/refunds/returns affect inventory? What is the collected-revenue definition?
- Is any payment processor used outside this repository, or are all digital payments manually checked? Which transaction identity remains stable across dates/banks? Can one payment cover multiple orders?
- Expected catalog/reel/image volumes, campaign arrival curve, session dwell, conversion rate, video quality/size, shopper geography and acceptable freshness/latency?
- Which staging resources, synthetic data, load generator, provider access and spend ceiling are approved? Approval is needed before any capacity test or production validation.

### Checks actually completed

- Repository discovery across routing/API handlers, collections/access/hooks/globals, cache helpers, media utilities, browser/cart/checkout/auth/admin code, test configuration, seed scripts, lockfile and installed Payload/Mongo/S3 internals.
- Static TypeScript: `tsc --noEmit --incremental false`, **passed**. No application/database initialization.
- Read-only ESLint across `src tests`: **28 errors, 265 warnings** at this revision. Errors span Orders (`prefer-const`), unescaped JSX in BeforeDashboard/order tracking, hook effect/ref/purity rules in header/cart/hero/admin/forms/navigation/product/theme/carousel components, and admin nav-link rules. These were not fixed during the audit. The summarized pipeline captured lint messages; its shell exit code is not a clean-lint assertion.
- Git working tree was clean at start. Production `.env` files are not tracked; `.env.example` and `test.env` are tracked filenames. No environment file values were read. A narrow filename-only credential-pattern scan of source/scripts/docs/public found no matches; this is **not** a full secret/history/deployed-bundle audit and does not certify absence of secrets. Logging review found recipient emails/full error objects; scrub/redact under J.
- Existing tests were inspected, not executed in this audit. Vitest excludes the live `api.int.spec.ts`; most integrity tests mock Payload and do not establish real transaction concurrency. `orderTracking.spec.ts` tests a local normalization helper rather than authorization on the actual route. The E2E TRX test accepts some initial failures and relies on product ID `1`; it is not a complete payment/inventory contract test.
- No checked-in CI workflow directory found. Playwright’s default config loads dotenv, launches the app and can perform writes against configured services. It was intentionally **not run**. Browser-only image/UX fixtures exist, but are not evidence of production throughput or end-to-end checkout safety. No new implementation tests/load scripts were added.
- No production DB, deployed APIs, headers, R2 objects, DNS records, credentials, monitoring dashboards or load generator were accessed. No build/dev server was started because application initialization/build-time CMS queries could touch configured data. No dependency advisory scan/package audit was run; exact-version security advisory review remains an approval-gated follow-up if network/package metadata checks are desired.

**Approval requested:** approve the P0 implementation scope first (custom API authorization, order/receipt privacy, authoritative checkout and transactional/idempotent inventory), plus an isolated staging environment/budget. Performance/caching changes should follow the validation sequence above; Redis adoption and paid infrastructure changes require their own decision after evidence.
