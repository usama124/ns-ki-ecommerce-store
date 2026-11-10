# Meta Pixel base code

Pixel `1123550367331651` is installed once in the shared storefront root and once in the independent global 404 document. These are separate document roots; nested pages do not install it again. Payload admin uses a separate layout and is excluded. All storefront pages, including account/checkout pages under that root, inherit the base code as requested.

The supplied async loader initializes the pixel and sends the initial PageView. A client component sends PageView on Next.js pathname changes, including back navigation. Initial hydration, StrictMode and remounts do not repeat the initial view. Query-only changes are not separate views. The hidden noscript image uses the same ID. No ecommerce/conversion events, advanced matching or Conversions API have been added.

This is the requested unconditional base installation: no new marketing-consent gate or production-only switch was introduced. Existing GTM behavior is unchanged. Review privacy/cookie disclosures and required marketing consent before production activation; the old analytics consent component is not mounted and does not govern this pixel. Meta's script may transmit page URL/referrer metadata; do not treat private storefront routes or token-bearing URLs as excluded by this installation. Do not put sensitive values into tracking events. A separately scoped privacy change is needed to gate or exclude pages.

Do not install this same pixel again through GTM or Meta's automatic setup. The repository cannot inspect the published GTM container: the owner must verify that it contains no duplicate Meta base or PageView tags. Automatic events configured within Meta must also be reviewed. No external Meta settings were modified.

Deployment and real verification remain required: use Meta Pixel Helper and Events Manager Test Events to confirm one initial view and one per route transition. Automated tests mock tracking; no real Meta requests are sent by tests. Blockers or browser privacy settings can prevent delivery. Site-wide base code alone does not implement Purchase or other ecommerce milestones.
