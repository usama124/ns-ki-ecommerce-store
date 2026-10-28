# Main-branch GTM behavior retained in develop

At the owner's explicit request, the merge of `05ae46a` from main retains main's
unconditional `GTM-PMHXK5RR` installation. The shared storefront layout includes the
head bootstrap and first-body noscript iframe; the independent global 404 includes
the same pair. Payload admin pages remain outside these public layouts.

The legacy `Analytics` component is no longer mounted by the application providers.
This prevents its opt-in prompt, direct GA4 loader and client-side page-view sender
from running alongside GTM. Main's snippets are unchanged. Theme, authentication,
cart, checkout, private receipt uploads, reporting and commerce security stay intact.

The older `docs/analytics-setup.md` instructions describe the retained, inactive
direct-GA4 implementation, not the active storefront installation after this merge.
Its `NEXT_PUBLIC_ANALYTICS_ENABLED` flag does not disable main's GTM snippets.
Consent, GA4 destination tags, page-view/history triggers and ecommerce event mappings
must be managed and verified in the GTM container. Installing this container does not
automatically migrate the old opt-in ecommerce event delivery; the inactive modules
remain in the repository for reference/future integration. No new GA4 property or
container configuration was published during this merge.

Server analytics/outbox code, its explicit enablement and privacy checks remain
unchanged. No existing consent is fabricated or implicitly granted to attach server
purchase attribution. Do not assume legacy server events will be delivered for
GTM-only visitors without a separately reviewed attribution integration.

This choice removes the previous application's basic opt-in gate for the GTM
container itself. Ensure the published container's tags and consent settings match
the store's privacy commitments. No production deployment, account configuration or
database mutation was performed by the merge.
