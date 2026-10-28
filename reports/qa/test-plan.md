# Ecommerce QA plan — 24 October 2026

Baseline: `fd4210f`. Audit only: no application fixes without separate approval.

## Safety and environment

The supplied gzip MongoDB archive is read-only input. Restore into a new, outbound-isolated Docker replica set: an untouched baseline DB and a working QA DB. Original catalog/account records are read-only during assessment. Create synthetic test users/products/orders in the working copy; change only test configuration overlays there. Never use production credentials, accounts, receipts, notifications or payments. Existing suites with dotenv/production assumptions will not run unchanged against the restored DB.

Capture only aggregate restore metadata and synthetic test evidence. Do not publish hashes, cookies, bearer links, email bodies, payment documents or actual customer details. The original archive is never overwritten. External requests from the local app/browser are blocked, except explicitly mocked service boundaries. Live checks are read-only HTTP navigation only, without logging in or ordering.

## Architecture and business-rule discovery

Inspect Next/Payload routing, authentication/access policies, cart localStorage and session lifecycle, product/category/variant queries, server pricing/shipping, all four manual payment methods, private receipt storage, Mongo transactions/idempotency, inventory allocations, admin endpoints, email outbox and rate limits. Mark absent/unverified features rather than inventing expected behavior.

## Planned execution layers

1. Existing Vitest baseline, TypeScript and lint; assess legacy E2E safety without executing production-bound helpers.
2. Existing isolated Chromium fixtures and real synthetic Mongo replica-set regression suite.
3. Restore integrity and aggregate data/schema/index/readiness checks, with baseline preservation.
4. Full local HTTP/browser journeys: browse restored catalog; synthetic discovery/variants/cart/refresh; customer registration/login/session/ownership; COD and digital-reference checkout; admin orders/status/stock; exact tracking; replay/failure/authorization checks; mobile/desktop/404 behavior.
5. Cart storage fault/long-lived-state simulations. Clearly label simulated time, not literal multi-day observation.
6. Receipt and email service boundaries: mocks/failure isolation unless an isolated service can be safely configured. Live Cloudflare/private-bucket exposure and real provider inbox delivery remain BLOCKED without test services.
7. Bounded local timing samples only; no production load or concurrency-capacity claims.

## Result labels and reporting

PASS means executed assertions succeeded; FAIL means demonstrated mismatch; BLOCKED means missing prerequisite; NOT TESTED means not executed; NEEDS REVIEW means no confirmed business expectation. Publish the A–R report, case matrix, defect register and execution summary under `reports/qa/`. Preserve failing evidence, investigate first, and request approval before application fixes. Maintain a separate status for baseline, restored-DB integration, browser fixture and live checks.
