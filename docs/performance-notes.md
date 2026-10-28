# Performance changes and verification

Date: 22 October 2026. These changes require a new production deployment.

Update, 28 October: the historical ten-connection MongoDB default below is superseded
by [environment-specific MongoDB budgets and Vercel lifecycle integration](mongodb-connection-management.md).

## Implemented

- Normal storefront requests no longer mount Payload's preview refresh listener. In draft preview, the library's initial mount refresh is suppressed while subsequent document-change refreshes remain enabled. This removes the mount/remount refresh path that can repeatedly retrigger not-found rendering.
- Added Next's global not-found fallback for unmatched routes across the storefront and Payload root layouts. It renders independently of CMS connections, auth providers, navigation queries, and live preview.
- Product and CMS metadata share their page's lookup using request-scoped React caching. Missing documents remain not-found results; database errors are no longer silently converted into missing documents on those routes.
- Navigation categories now use one selected-field, depth-zero query shared by the header, shop sidebar, and category lookup. The former sidebar also sorted on a nonexistent `title` field; it now uses category names.
- Header settings/category reads run concurrently. Public navigation/settings caches include relationship depth in their identity, expire after 60 seconds, and invalidate after relevant CMS changes. Stock, orders, customer records, checkout, and preview content are not persisted in these caches.
- Removed an unused homepage category lookup, parallelized homepage data reads, limited product-card fields, and reduced nested homepage reel product payloads.
- Shop and category listing queries exclude unused rich text, videos, and variant arrays. Shop keyword queries now filter titles instead of ignoring the search term.
- Sale pages read current campaign bounds at request time, reuse cached public campaign settings, and avoid querying the whole catalog when there is no live targeted sale. Eligible products are filtered in the database before pricing is computed.
- Cart stock validation now fetches products in one batch, with bounded input and fresh stock. Missing products/variants are unavailable; database failures return a retryable error instead of claiming stock is valid. Browser checkout navigation respects validation failures.
- MongoDB pools default to ten connections per warm instance, no minimum idle connections, and ten-second connection/queue waits. PostgreSQL pools default to five connections per instance with bounded connection waits and idle expiry. Override through `DB_POOL_MAX` and `DB_CONNECT_TIMEOUT_MS`. Payload already reuses its initialized instance; no second application connection cache was added. SQLite/libSQL retains its adapter-managed connection behavior.
- The main header logo is prioritized and goes through Next image optimization; hidden drawer/footer logos no longer force the unoptimized 580 KB original at high priority. Shoppable videos defer loading until playback is needed. Hero space is reserved during hydration to reduce layout shift, including the mobile-only configuration.
- The admin toolbar loads only for authenticated administrators and reuses storefront auth rather than mounting another auth client for every visitor.
- Enabled the installed Sharp processor in Payload, allowing configured image derivatives for media handled by its image-processing pipeline. Existing uploads are not retroactively resized; verify direct R2 upload processing separately.
- Moved robots metadata to `src/app/robots.ts`: the production route manifest did not register it inside the storefront route group, so `/robots.txt` previously fell through to CMS routing.
- Moved the Orders login redirect outside its catch block and corrected the logout-to-shop link. Restored ESLint execution with the current Next flat configuration and updated an obsolete email-test expectation for `/store-admin`.

## Checks

- Added regression tests for preview remount behavior, database limits, public cache identity/invalidation, and batched stock validation.
- Integration suite: 26 tests passed under Node 22.23.2. The shell's default Node 18.19.1 is incompatible with current tooling; use Node 22 for development/build/test.
- TypeScript and the final production webpack build passed, including the root robots route and enabled Sharp processor.
- Full lint now executes instead of crashing on configuration. Existing lint findings remain in older UI/admin/config files, including hook/compiler recommendations and CommonJS config imports; this is not a clean-lint certification.
- Read-only HTTP smoke checks covered home, shop, sale, login, signup, forgot password, checkout, tracking, Orders redirect, missing CMS/product/category paths, unmatched nested paths, sitemap, and robots. Checking the built route manifest exposed the robots registration issue and prompted the move above.
- Initial local production request took approximately 5.7 seconds; subsequent tested ordinary pages took roughly 16–388 ms including response-body transfer. An unmatched nested route returned 404 in roughly 12 ms. These are individual local smoke measurements against the configured database, not controlled benchmarks or real-user speed scores. They must not be compared directly with public-site timings from a different environment.
- Next can stream a missing document response after starting an HTML response; in that case HTTP status may be 200 with noindex/not-found content. Unmatched routes use the independent global 404. Confirm crawler behavior after deployment.
- Final rebuilt-server checks: `/robots.txt` returned 200 with `text/plain` and the correct canonical sitemap URL; an unmatched nested path returned 404 in 23 ms; missing product/CMS paths returned 404 in 153/178 ms; a real product returned 200; signed-out `/orders` returned a 307 login redirect. Missing category responses finish as streamed not-found content because of the shop layout's Suspense boundary.
- The final test of the optimized 256px logo returned 9,732 bytes versus the 580 KB source. This is one tested rendition, not the size of every responsive rendition.
- A separate fresh-process TSX import of Payload configuration took about 2.9 seconds without opening a database connection. Configuration/module initialization contributes to cold latency as well as database/network setup; TSX import timings are not production webpack timings. The first database-backed product response in the final local smoke run took about 6.5 seconds. Cold-start latency remains unresolved and must be measured/tuned in the deployment environment.

## Deployment and remaining work

1. Deploy the new code; confirm the custom domain points to that deployment. Test nonexistent single-segment, nested, product, and category URLs, including navigation back to a valid page. Confirm there are no repeated RSC refresh requests. Test CMS preview save/refresh as well.
2. Place the application runtime near the database region. Budget `DB_POOL_MAX × maximum warm instances` plus admin/jobs/build processes against the database connection allowance. PostgreSQL serverless deployments should use the provider's appropriate pooled connection URL. Pool limits reduce connection pressure but do not eliminate cold starts or network latency.
3. Measure real production LCP, INP, CLS, TTFB, payload sizes, database latency, and cold/warm response distributions on mobile networks. No real-device browser trace or field Core Web Vitals certification was completed here.
4. Provision workload-driven indexes after inspecting query plans and the chosen adapter. Priorities are published/featured product filtering, category relationships, price/title sorts, and order date/status queries. Do not blindly apply MongoDB compound indexes to SQL relationship tables. Plan SQL migrations separately; none were applied by this pass.
5. Existing admin/report endpoints still load bounded datasets into memory (for example 500 orders/300 products). Move reports to authenticated, paginated database aggregation as catalog/order volume grows; this remains covered in the reporting implementation plan. Existing endpoint authorization/order-privacy issues also require the separate security work already identified in the codebase review.
6. Product stock mutation remains read-modify-write and is not made atomic by query batching or connection pooling. Implement the inventory transaction/concurrency work from the commerce plan before high-volume sale traffic.
7. Standardize source imagery and compress large hero videos before upload. The currently shared Apple/tab icon is a 1.5 MB source; a dedicated small favicon should be generated as a separate asset task. Existing media may need regenerated derivatives after checking storage behavior.
8. Keep public shell caches separate from personalized data. Validate freshness after category, footer, announcement, and campaign edits; the TTL is a fallback, not a replacement for invalidation.

The pass addresses verified request/render/query/media bottlenecks. It does not establish that every page is maximally optimized, fix all security/business-logic issues, or guarantee a loading-time target on all devices and networks.
