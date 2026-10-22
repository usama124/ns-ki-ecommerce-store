# Admin image optimization

In **Content → Media**, select an image normally, then use **Edit, crop & compress image**. This also works in the Media creation drawer opened from a product. Existing JPEG/PNG/static WebP records can be opened and optimized in place.

1. Choose Full image, Product portrait (2:3), Square, or enter a custom crop as percentages. The dashed boundary previews the selected area. Cropping deliberately discards pixels outside that boundary.
2. Set maximum width/height and quality. Defaults are 1600 × 2400 bounds and WebP quality 85. Aspect ratio is preserved and smaller originals are never enlarged. Maximum output bounds are 4096 × 4096; inputs over 40 megapixels are rejected by this editor.
3. Compare the original file size with the generated WebP preview. The preview's byte count is measured from an actual browser encoding, not guessed. Images can become larger; the UI warns instead of promising a reduction. Inspect fine fabric details before choosing a lower quality.
4. **Apply WebP image**, then **Save** the Media record. Apply replaces pending native Payload crop/focal edits to prevent a second unintended crop. Cancel leaves the original upload and its edits unchanged. Saving without Apply retains the normal upload behavior.

Processing happens locally in the browser before the existing direct-to-R2 upload, so this does not route large files through Vercel request bodies. Canvas encoding strips source EXIF metadata and preserves PNG transparency. Browser-decoded orientation is used. Server-side Payload transformations and responsive thumbnails remain configured as before, so the final stored main file can differ from the preview byte count; derivatives require additional storage. No database schema migration or environment variable is required (the editor is a UI-only field).

The optimizer is intentionally optional: native selection, drag/drop, URL upload, bulk upload, API uploads, checkout payment proofs, and videos keep their existing flows. To optimize a bulk-uploaded file, open its Media record individually. GIF/SVG/video are not converted. Animated WebP and APNG are detected and refused by the editor to avoid flattening animation. Browser WebP encoding is checked explicitly; failures never replace the selected original.

Editing an already stored image requires browser access to its public media URL. If R2 rejects that GET, configure CORS on the bucket or choose a local replacement. Normal existing upload permissions are unchanged.

## Verification

Run the Vitest suite and TypeScript check with Node 22. Tests cover sizing, crop bounds, no upscaling, invalid/oversized dimensions, quality validation, WebP/animation handling, encoder failures and cleanup, measured sizes, Apply/Cancel, existing-media fetch errors, stale file selection, read-only/submitting states, and non-image upload preservation. These tests mock browser decoding/canvas and Payload hooks.

Run `npx playwright test --config playwright.images.config.ts` for three isolated real Chromium tests covering encoding, crop/transparency, quality-dependent sizes, no enlargement, and EXIF orientation. This config does not start the app or write to a database or bucket. It requires Playwright Chromium to be installed. These checks do not replace a full admin upload/save test against a staging R2 bucket.

Before release, smoke-test a portrait JPEG with EXIF rotation, transparent PNG, small image, landscape image, static WebP, animated WebP/APNG, and a video in the admin. Test both local and R2 storage, product Media drawers, updating an existing record, cancellation, and a failed R2 PUT. Confirm saved URLs and storefront thumbnails display the expected result. Do not use production payment proofs for these checks.
