# Checkout locations and merchant payment QRs

## Locations

Checkout lists province/region first, then a city/town dropdown for that region.
Changing the region clears the old city. The separate city search box and manual-entry
button have been removed at the store owner's request. Customer city and province
remain strings, so existing orders require no migration. The order endpoint validates
region names, bounded city input, and known city/region mismatches before DB writes.
Historical orders are not revalidated or changed. Existing shipping tariffs are unchanged;
the shipping major-city list is separate from the address catalog.

The local catalog has **3,027 unique region/name pairs**, not a guarantee of every
village or courier coverage. Two source entries with no assigned region are excluded.
Duplicate names within one region are deduplicated; identical names in different
regions remain valid. Missing towns must be added to the catalog to be selectable.
The API still accepts valid unlisted town names for backward compatibility, but checkout
no longer offers manual entry. No external location API is
called at checkout, and the catalog is imported only by checkout/location validation.

Source: [PlaceDB Pakistan](https://placedb.org/countries/pakistan/), Wikidata-derived
CC0-1.0 data from the [Mindstellar location-data pipeline](https://github.com/mindstellar/location-data).
Frozen release: `2026-09-20T1335Z`.
Download: https://geo.mindstellar.com/releases/2026-09-20T1335Z/json/PK.json
Source SHA-256: `87f6d543897a39590a23d49c9b5cae9265a89e55869f8253bc5b6d185e57e5da`.
Generated region counts: Punjab 1500, Sindh 354, KP 668, Balochistan 249,
Islamabad Capital Territory 26, Azad Kashmir 120, Gilgit-Baltistan 110.

To refresh, download a reviewed release and run
`node scripts/import-pakistan-locations.mjs /path/to/PK.json`, inspect the diff,
update provenance/counts above, then run the location tests. The data license is CC0;
no publisher application source code is included. Source accuracy is not guaranteed.

## Admin payment QRs

Go to **Settings → Site Settings → Payment Account Details**. Each Bank / Raast,
JazzCash, and EasyPaisa group now has an optional **Payment QR Code** media upload.
Upload the actual bank/wallet merchant QR (PNG/JPEG/WebP), keep its full white border,
save, and test scanning on a real phone. Do not crop or aggressively compress QR codes.
These images are public checkout assets; never upload private receipts here.

Checkout populates these upload relationships at depth 1 and renders the original
uncropped image with `object-contain`. QR codes are never synthesized from plain
account/mobile text and no account data is sent to a third-party QR generator.
Missing/unpopulated/broken images display a fallback asking customers to use account
details. Changing methods cannot retain a previously failed QR. COD has no QR.
Admin-only Site Settings update access and payment enable/disable switches are unchanged.

MongoDB requires no manual schema migration. PostgreSQL deployments must apply the
registered `20261026_010000_payment_qr_codes` migration before serving the updated
schema; it adds three nullable media references with `ON DELETE SET NULL`. Rollback
removes only those references (not media files or orders). No migration has been run
against production as part of this implementation.

## Verification (local)

- Full configured Vitest suite: **244 tests passed in 27 files**. Includes region
  coverage, region changes, API mismatch rejection before writes, tariff
  compatibility, QR upload schema, original-image rendering, missing/broken image
  fallbacks, populated settings reads, and payment-method switching without stale QR.
- Source/test TypeScript check passed using a temporary config excluding stale
  generated `.next/types` files left from another branch.
- New files pass targeted ESLint; existing checkout/order files retain their
  pre-existing `any`/unused-variable warnings, with no lint errors. `git diff --check` passed.
- Generated Payload types refreshed using dummy configuration with no DB connection.
- No production deployment, live database mutation, production build, or real-device
  bank-app QR scan performed. Verify the uploaded merchant QR with a real phone after
  saving it in admin. PostgreSQL migration execution is still deployment work if that
  adapter is used; MongoDB needs no manual schema migration for these optional fields.
