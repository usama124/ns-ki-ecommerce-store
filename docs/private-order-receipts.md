# Private order receipt storage

Implemented 24 October 2026. Separate from public product media; no production deployment or live bucket test has been performed.

## Configuration

Fill these server-only placeholders in `.env` locally and in Vercel for the intended deployment environment:

```dotenv
R2_RECEIPTS_BUCKET=your-private-bucket-name
R2_RECEIPTS_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_RECEIPTS_ACCESS_KEY_ID=your-bucket-scoped-access-key
R2_RECEIPTS_SECRET_ACCESS_KEY=your-bucket-scoped-secret
```

Leave the existing `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_PUBLIC_DOMAIN` unchanged. The receipt code never falls back to them. It rejects the public catalog bucket name and incomplete receipt settings. Never set a receipt public domain or use `NEXT_PUBLIC_` credentials. Restart locally / redeploy after updating environment variables. Do not commit `.env` or send keys in chat.

Use a distinct private bucket with public development URL access disabled, no publicly exposed custom domain and no public proxy. Restrict its R2 token to that bucket with object read/write permissions. Creating a bucket does not prove that later configuration cannot make it public; verify its actual exposure before rollout. The application cannot inspect your Cloudflare account's public-access settings. Browser uploads/downloads go through the application server, so this flow does not require browser-to-R2 CORS rules or public/presigned R2 URLs.

## Customer and admin behavior

- Digital-payment checkout accepts an optional JPEG, PNG or WebP receipt up to 3 MiB. Transaction reference remains required. COD and reference-only transfers remain available.
- The order is created first. Only then does the browser upload to `/api/orders/{id}/receipt` using its signed order capability. A failed receipt upload does not retry order creation or undo the order. Confirmation directs the customer to their secure order details link to retry.
- Uploads require an authorized account owner or valid seven-day order-specific guest link, and an order still awaiting digital-payment verification. Admins can view but cannot upload as the customer. Anonymous order IDs/email addresses alone grant no access.
- One immutable receipt per order is enforced with a conditional R2 create (`If-None-Match: *`), including concurrent first uploads. An existing file cannot be silently overwritten. Corrections require support; no public replacement/delete API is provided.
- The authenticated API decodes the actual image, verifies its declared MIME type, rejects corrupt/animated/oversized inputs (16 megapixels, maximum 8000px per axis), strips metadata and normalizes to WebP at quality 90, fitting within 2400×2400 without enlargement. PDFs, GIFs, SVGs and videos are not accepted. Check the uploaded receipt is readable before using it for payment verification.
- Customers view/retry from their authorized order detail page. Admins view from the Payload order editor or the order dashboard's detail and quick-verification panels. New receipts do not appear in the public Media collection.
- Viewing rechecks order authorization and returns image bytes with private/no-store, no-referrer and nosniff headers. No bucket credentials or R2 download URLs are sent to the browser. A guest link remains a forwardable bearer capability; anyone holding it can access that order until it expires. Do not share it publicly.

## Storage and operational limits

Objects are stored at `order-receipts/v1/{canonical-database-order-id}.webp`. The server obtains the canonical ID from the authorized order; callers cannot select a filename or unrelated storage key. Receipt existence is obtained via authenticated HEAD requests to R2. This implementation adds a UI-only Payload field and no new database columns, collections or schema migration.

Create-only uploads rely on R2's documented atomic conditional writes, not on the preliminary HEAD check. A missing HEAD result after a failed upload does not prove an in-flight write cannot still commit; every retry retains the create-only precondition. See [Cloudflare R2 consistency model](https://developers.cloudflare.com/r2/reference/consistency/).

The receipt upload does not update order status, change inventory, mark payment as verified, or trigger order hooks/emails again. Staff must still verify transfers. Cross-order image-hash duplicate detection is not implemented for this new private path; existing transaction-reference checks remain unchanged. A concurrent staff status change can occur after upload authorization; uploading an image never confirms payment.

There is no unauthenticated pre-upload endpoint or temporary-object workflow: uploads require an existing authorized order. Deleting an order later does **not** automatically delete its receipt. Define an approved retention/legal-hold policy and implement authorized cleanup separately. Do not configure a short blanket expiry that would remove needed financial records. Existing public-bucket receipts have not been moved, deleted or purged; historical cleanup remains a separate task.

Distributed abuse controls, broader checkout idempotency/stock transactions and full production hardening remain tracked in the P0 plan. This feature alone is not full P0 sign-off. External CDN rules must not force public caching of private APIs/order pages. Keep request bodies and signed-link query parameters out of application/CDN analytics and logs where possible.

## Verification and rollout

Automated tests use mocked Payload/S3 operations, actual local Sharp decoding, and isolated browser fixtures. They never use the real database, bucket or payments. Before rollout, fill the configuration and verify on staging:

Local checkpoint: 237 unit/integration tests (including 30 receipt tests) and all 22 isolated Chromium tests passed. TypeScript and targeted lint checks for the new receipt code passed. These results are not a live R2 integration or production-privacy certification.

The production build also completed with dummy service settings, warnings, and expected refused loopback MongoDB connections. It checks compilation/build compatibility only, not real database or storage operation.

1. A digital order with a small valid receipt produces exactly one private object; public product uploads still work.
2. Signed guest, owning customer and admin can view it; unrelated customers and unsigned visitors cannot.
3. Anonymous access to any configured public R2 URL does not expose the receipt. Inspect bucket settings as well as app behavior.
4. Invalid image types, oversized inputs, duplicate/concurrent uploads and uploads to non-pending/COD orders are rejected.
5. Simulate a storage failure: the order remains created, confirmation offers a secure retry path, and retry never creates another order.
6. Verify that Vercel/Cloudflare preserve private no-store headers and that staff can read the receipt clearly before approving payment.

The existing main E2E configuration is DB-backed; do not run it against production settings. Use the isolated `playwright.images.config.ts` suite for local browser regression checks.
