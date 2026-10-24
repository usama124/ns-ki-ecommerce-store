# QA case inventory

Baseline `fd4210f`. PASS requires executed assertions; a successful response alone is not sufficient. Final run totals and unresolved cases are in [test-execution-summary.md](test-execution-summary.md). This is a bounded case inventory, not an assertion of exhaustive coverage.

After approved fixes, the restored-app suite expands to **22 cases, all PASS**: QA-16 now runs all four manual payment methods on mobile; QA-17 verifies administrator pagination and explicit inventory scope. QA-07/09/14/15 failures and QA-16 Origin blockage below describe the historical audit, now resolved locally. See [remediation verification](remediation-verification.md).

## Restored-application automation

All are implemented in `tests/qa/restored-app.spec.ts` with one worker, no retries, local-only requests and synthetic data. QA-06 expands into three independently counted tests.

- QA-01: anonymous catalog omits draft fixture; parent category output contains child-assigned published product.
- QA-02: nonexistent generic/product/category URLs terminate within bounded redirects and include noindex. Streamed 200 is accepted; strict HTTP 404 compliance is not established.
- QA-03: orders collection GET is custom-route 405; unauthenticated administrator mutation denied.
- QA-04: tampered expected amount returns current Rs. 1,350 quote; fractional quantity rejected.
- QA-05: authenticated COD creation, repeated same-key response, single stock deduction, owner/foreign read, administrator cancellation/repeated cancellation, stock restored exactly once.
- QA-06-bank: bank-transfer reference creates pending_verification, no COD fee.
- QA-06-jazzcash: wallet reference creates pending_verification, no COD fee.
- QA-06-easypaisa: wallet reference creates pending_verification, no COD fee.
- QA-07: administrator quantity edit keeps line sum, fees and total consistent. Confirmed FAIL, QA-B01.
- QA-08: product heading and purchase controls visible; no horizontal overflow at desktop 1440 and mobile 390. This is not a complete purchase.
- QA-09: malformed persisted cart `{}` does not produce a reduce/map runtime error or hide navigation. Requires JavaScript hydration to be meaningful; inspect final result rather than treating earlier pre-hydration pass as conclusive.
- QA-10: mobile size selection, add-to-bag, storage persistence, refresh cart count, populated checkout and layout screenshot.
- QA-11: exact order/email tracking, confirmed state, no private customer/items fields, no-store and wrong-contact denial.
- QA-12: anonymous/foreign/forged receipt access denied; owner and valid guest token reach missing-storage fail-closed 503. Real storage success explicitly BLOCKED.
- QA-13: customer denied admin orders/inventory, cannot grant self admin role, administrator orders endpoint succeeds.
- QA-14: valid login must not navigate to external `redirect`; request interception aborts any external attempt. Never actually visits third-party target.
- QA-15: COD confirmation template must not claim verified/paid; no email sent. QA-B02.
- QA-16: complete mobile guest COD form submission, confirmation and cart clearing; actual POST is reached but local Origin rejection returns 403, so confirmation/cart-clear assertions are BLOCKED/unexecuted.

Final production-build status: QA-01–06 (including three QA-06 methods), QA-08, QA-10–13 PASS. QA-07, QA-09, QA-14, QA-15 FAIL with confirmed defects. QA-16 has a failed HTTP-status assertion, classified BLOCKED for business outcome pending a correctly configured staging Origin. Totals: 18 cases, 13 passes, 5 failed assertions. Earlier dev-run statuses are superseded.

## Existing suites executed

- Vitest: 254 business/security cases across 28 files; server pricing/shipping/sales, checkout validation, ownership/private pages/receipts, idempotency helpers, database options, media/category selection and related regressions. Mocked boundaries must not be described as live services.
- Chromium fixtures: 23 cases across seven files; tight 2:3 crop, WebP actual bytes/quality/orientation, responsive stored-size selection at DPRs, explicit requote submission, private-receipt retry, persistent uncertain checkout key, mobile/desktop collection UX, reel navigation/sizing and video docking.
- Native replica-set: 15 cases in `tests/commerce/mongodb.spec.ts`; concurrent last unit, identical retry, lost response, atomic rollback, unconfirmed quote, cancel/repeated cancel/reactivate/backorders, active line reconciliation, rate-counter atomicity, concurrent admin cancel, delete/reserved-variant restrictions, stale product form, legacy fail-closed cancellation, worker leases/retries/dead-letter and private notes exclusion.

## Additional designed coverage not signed off

- B-01 BLOCKED: actual customer/admin private-bucket upload and view; anonymous object URL/public access check. Need synthetic private R2 test bucket and approved sandbox credentials.
- B-02 BLOCKED: inbox delivery, account recovery and actual scheduler/worker cadence. Need intercepted mailbox/test provider and isolated scheduler.
- B-03 BLOCKED: live apex/www DNS/TLS/canonical/sitemap and Analytics behavior; available web access reported inaccessible, not proof of a site outage.
- B-04 NEEDS REVIEW: full browser checkout submission Origin behind this local proxy; verify correct same-origin policy in production-shaped staging.
- N-01 NOT TESTED: literal hours/days inactivity, token expiry, cookie clearing, cross-device/account cart merge and offline return. No such cross-device feature was found.
- N-02 NOT TESTED: all search casing/whitespace/special-character combinations, filters/sort/pagination combinations, every header/footer/CMS link and missing-media permutations.
- N-03 NOT TESTED: admin/browser lifecycle through shipped/delivered, courier proof, payment-verification audit trail, partial refunds/returns and digital settlement. Clarify absent workflows first.
- N-04 NOT TESTED: large-report 501-order/301-product boundary data; code limitation confirmed but no large fixture was inserted.
- N-05 NOT TESTED: complete keyboard/screen-reader/contrast audit, Safari/Firefox/real iOS/Android video autoplay.
- N-06 NOT TESTED: gradual production-shaped staging load, connection saturation, slow-query profiling and credible high-percentile latency. Only bounded local development samples collected.
- R-01 NEEDS REVIEW: permitted lifecycle transition graph, COD cash-collection/revenue definitions, abandoned cart attribution/retention and saved-address launch requirements.

## Re-run prerequisites

Use the original read-only archive to restore a **new working namespace**; preserve baseline. Start only the isolated QA app with dummy explicit env and no production credentials. Seed once; fail rather than duplicating known fixture slugs. Tests intentionally create a bounded number of synthetic orders per invocation; repeated runs consume stock. For a deterministic rerun, use a fresh working restore rather than deleting individual records from mixed data. Never point legacy dotenv-based E2E configuration at this environment.
