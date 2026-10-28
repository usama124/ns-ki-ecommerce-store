# User-journey analytics — batch 1

Historical direct-GA4 guide: the owner subsequently selected main's GTM installation.
See [the GTM merge notes](gtm-main-merge.md) for the active storefront behavior.
The direct-GA4 component described below is retained but no longer mounted.

Implemented 25 October 2026. At that time, direct GA4 was the selected transport and no GTM container had been provided. No Google accounts were created or changed by this implementation.

## Current implementation

Journey: entry → catalog/search → product/size → cart → checkout → order placement → confirmation/payment verification → fulfillment. Batch 1 measures browser stages through checkout intent; batch 2 implements optional server order placement and confirmation milestones, pending rollout. Payment collection and fulfillment reporting remain separate future stages. Optional login/account branches are not sent to analytics.

The unconditional head tag was replaced by one optional, consent-gated loader. Public configuration uses the existing measurement ID `G-PRKY09PGEB`. `.env` and `.env.example` contain:

```dotenv
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_GA4_ID=G-PRKY09PGEB
```

Leave the flag false until the production checklist below is complete. This intentionally stops the old unconditional tracking; deploying with the flag false sends no analytics from this integration. Analytics is optional: carts and checkout keep working when declined, blocked or misconfigured.

Implemented events:

- `page_view`: one explicit event per measured navigation, including query-only navigation/back-forward updates. Queries are used only to detect navigation, never included in the event.
- `view_item_list`: each product becomes an impression when at least half its card is in the visible viewport of a foreground tab; deduplicated for the mounted card/list/index. Individual item impressions are sent separately. No below-the-fold render-only impressions.
- `select_item`: image/title activation. Wishlist toggles do not count as product selection.
- `view_item`: product visit, not size changes/rerenders.
- `add_to_cart` / `remove_from_cart`: actual successful user quantity deltas, centrally owned by CartProvider outside React updater callbacks. Rejected stock actions, storage restoration, automatic stock corrections and post-checkout clearing do not emit these events.
- `view_cart`: explicit cart drawer opening.
- `begin_checkout`: once after entering a checkout with items.
- `add_shipping_info` / `add_payment_info`: validated contact/delivery submission, with general shipping tier and allowlisted manual payment type, deduplicated across unchanged retries.

Item identity is stable product ID with size/color variant, PKR unit price and quantity. List context/position is available on list/select events; cart events currently do not preserve acquisition/list/category attribution. Browser prices describe displayed intent, **not authoritative purchase value**.

## Privacy and consent behavior

Basic opt-in is the initial implementation choice, subject to client consent-copy/privacy-policy review. Optional analytics is off until accepted. Advertising storage, advertising user data/personalization and Google signals stay disabled. Preferences persist for up to 180 days when storage works; blocked storage falls back to the current browser session. Cookie settings can reject previously accepted analytics. Rejection disables GA collection and discards the local command queue; denied actions are never queued for replay. This is not a certified CMP or a statement of legal compliance.

Only public catalog routes and `/checkout` are measured. Account, login, tracking, order, secure confirmation, preview and administrator routes are excluded. Page titles are generic; URLs contain only allowlisted public paths, without query/hash; referrers are blank. Loader requests use no-referrer. Names, contact details, addresses, references, proof files, receipt links, order tokens and free-form errors are never part of our event payloads.

UTMs and referrer-based campaign attribution are deliberately not implemented in this batch. Arbitrary campaign/search input is not forwarded. Returning-user/audience data remains subject to consent, cookies, blockers and GA4 processing; the code does not promise every visitor can be identified or tracked across devices.

Production guards require an explicitly enabled production build, HTTPS, a non-local host, valid measurement ID and exact configured `NEXT_PUBLIC_SERVER_URL` origin. Vercel preview deployments are blocked server-side by `VERCEL_ENV`, with an additional public deployment guard if `NEXT_PUBLIC_VERCEL_ENV` is configured. Set production variables only for the production deployment environment.

## Before enabling production

1. Client confirms ownership/access to the GA4 property/web stream for the existing ID; confirm PKR and Asia/Karachi reporting settings. Do not assume that knowing the ID grants property access.
2. Review consent wording and privacy/cookie policy with the client. Decide whether a dedicated CMP is required before rollout.
3. In the GA4 web stream, **disable Enhanced Measurement for this integration**, including automatic/history page views, form interactions, site search, outbound clicks and other automatic collection. Set `send_page_view: false` remains enforced in code, but it alone does not disable GA4 history-based Enhanced Measurement. Automatic collection could duplicate events or bypass our URL/form allowlists.
4. Confirm there are no separately injected GA/GTM tags from another integration, hosting setting or custom HTML.
5. Set the exact canonical HTTPS `NEXT_PUBLIC_SERVER_URL` and GA4 ID. Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` for the production environment only, rebuild and redeploy. Leave local/test/preview disabled. No API secret belongs in any NEXT_PUBLIC variable.
6. Validate consent accepted/denied/revoked, navigation/back-forward, visible cards, cart deltas, checkout steps and actual request payloads in Tag Assistant/GA4 DebugView using an authorized test property/staging arrangement. Test scripts blocking, too. Local tests intercept Google; they do not prove real ingestion/report processing.
7. Use GA4 reports only for verified stages. Server purchase delivery requires the separate [batch 2 rollout](analytics-server-rollout.md). Do **not** claim conversion/abandonment reporting is complete before real ingestion and funnel validation.

## Batch 2 — implemented, disabled pending rollout

- Optional GA `get` callbacks capture consented client/session IDs at checkout, with a 300 ms ceiling and no cookie parsing or invented identifiers. Missing IDs skip backend analytics, not checkout.
- Transactional `order_placed` / first-confirmation `purchase` snapshots, a separate private analytics outbox, stable event keys and an authenticated worker. The thank-you page never sends purchase.
- Server-only Measurement Protocol configuration, validation-only delivery, lease recovery without blindly resending ambiguous requests, expiry and aggregate queue status.
- Pending-event withdrawal using an unguessable browser capability; see rollout limitations, retention and activation steps in [analytics-server-rollout.md](analytics-server-rollout.md).

## Still pending — next batches

- Actual payment and partial-refund recording is implemented in a separate admin panel with explicit activation; see [payment recording](payment-recording.md). GA4 allocation/delivery of refunds and paid-revenue semantics remain pending. Current `purchase` still measures accepted order merchandise value, not collected cash or net revenue; COD is marked `cod_due`.
- Client GA4 funnel/abandonment/trending dashboards, UTM/referral policy, reporting definitions and validated real ingestion.
- Admin Reports, historical operations, actual-money recording and derived daily trends/stock inactivity/recorded balances/allocation estimates are implemented. Setup/activation is explicit. Physical unit aging still needs receipt/lot data; settlement/reconciliation and optional GA4 Data API integration remain pending. See [admin reporting guide](admin-reporting.md), [history rollout](historical-operations.md), [payment recording](payment-recording.md) and [historical insights](historical-insights.md).
- GTM migration, optional search/video/social events and deeper attribution metadata.

The thank-you/secure order page does not emit purchase; no artificial conversions are generated by visiting/reloading it. Do not interpret `begin_checkout` or a clicked submit button as a completed purchase.

## Create the client-owned GTM container later

1. Sign in at [Google Tag Manager](https://tagmanager.google.com/) with the **client-owned Google account**.
2. Choose **Create Account**, name it for the client's business and select the country.
3. Create a container named `siblingsbynski.com`, choose **Web**, and accept the required terms.
4. Copy the public container ID beginning `GTM-` and share that ID (not a password, login cookie or API secret). Give developers the appropriate account/container permissions while retaining client ownership.
5. Do **not** paste the installation snippets into the website yet. The next migration must replace this direct loader, configure matching GA4 events/consent/safe page fields, and validate in GTM Preview before publishing. Running both loaders would duplicate tracking.

Use the existing GA4 property/measurement ID as the destination; creating a GTM container does not itself create the analytics reports or ecommerce event mappings.

Official references: [GTM account/container setup](https://support.google.com/tagmanager/answer/14842164), [manual GA4 page views](https://developers.google.com/analytics/devguides/collection/ga4/views), [ecommerce events](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce), [consent implementation](https://developers.google.com/tag-platform/security/guides/consent), [GA privacy/disable controls](https://developers.google.com/tag-platform/security/guides/privacy).

## Verification scope

New automated coverage includes production/preview/local gating, private-route exclusion, safe payloads, singleton loader, consent/revocation/storage failure, accurate deltas, real CartProvider behavior under StrictMode, list impressions, product selection/view and checkout entry. Browser analytics requests are intercepted and never reach Google. See test results recorded at handoff; real account-side configuration and ingestion remain owner/staging tasks.

Verified for this batch:

- `vitest run --config vitest.config.mts`: **330 passed**, including the new SSR consent-controls regression and latest-server-quote intent pricing.
- `playwright test --config playwright.images.config.ts`: **26 passed**, including three enabled-analytics tests with intercepted Google requests and existing image/video/checkout/layout regressions.
- `playwright test --config playwright.qa.config.ts --grep 'QA-08|QA-09|QA-10|QA-14|QA-15|QA-16' --reporter=list`: **9 passed** against the isolated production build and restored working database; all four synthetic mobile manual-payment checkouts still succeed. Existing historical QA JSON evidence was not overwritten.
- **365 tests passed** across those three executed layers. The full native commerce suite was not rerun in this frontend-only batch; previous results are not counted again.
- Production webpack build, TypeScript, targeted analytics lint and `git diff --check`: PASS. Build emits warnings as before. Existing repository-wide lint debt was not remediated by this batch.
- No production deployment, real Google collection, real payment, email send or production database mutation. Temporary QA services were stopped after testing; baseline restore/original products remain unchanged.
