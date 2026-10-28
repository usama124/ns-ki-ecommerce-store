# QA execution ledger — 24 October 2026

Baseline `fd4210f`. No application fixes or production mutations. Final restored-browser results are recorded in `test-artifacts/restored-browser-results.json`; do not treat earlier harness failures as confirmed application bugs.

This is the **initial audit ledger**. Subsequent approved fixes and final all-passing results are recorded separately in [remediation verification](remediation-verification.md) and `test-artifacts/remediation-browser-results.json`. Production data was not modified during either phase.

## Completed checks

- Archive: `gzip -t` passed; namespace dry run and separate baseline/working restores completed. Original source is read-only. Aggregate baseline: 16 published products, 3 categories, 86 media, 9 sizes, 1 user, zero orders. Baseline remained zero orders after synthetic working-copy tests.
- `vitest run --config vitest.config.mts`: **254 passed**, 28 files, exit 0.
- `tsc --noEmit --incremental false`: PASS, exit 0.
- `eslint . --format json --output-file /tmp/nski-qa-eslint.json`: FAIL, exit 1; **31 errors, 265 warnings**. Primarily React hook/ref/purity rules, link/escaping and CommonJS import rules. Lint failure is not proof every flagged component breaks at runtime.
- `playwright test --config playwright.images.config.ts`: **23 passed**, exit 0, 24.5 seconds. Isolated browser components, not full restored application.
- Native Mongo suite: **15 passed**, exit 0, 6.81 seconds using real local replica-set transactions in separate `nski_commerce_test_20261024`. Executed inside outbound-isolated app container with `RUN_COMMERCE_DB_TESTS=1 node node_modules/vitest/vitest.mjs run --config vitest.commerce.config.mts --configLoader runner`.
- Production compilation in disposable snapshot: `node node_modules/next/dist/bin/next build --webpack` PASS, exit 0; compiled with warnings, TypeScript completed, 20 static pages generated. No production env loaded. Replaced dev server with that build for final browser investigation.
- Local development latency: 25 sequential public GET samples (5 per route), all HTTP 200. Values/limitations in main report section K.

## Restored-app run history

Initial 11-case run: 2 passed/9 failed; investigation identified invalid harness assumptions (stale categories inserted after cached navigation; Origin rewritten by proxy; expecting generic collection GET where custom route returns 405). Not registered as nine product defects.

Corrected 11-case run: **10 passed, 1 failed**; QA-07 reproduced Rs. 1,350 versus Rs. 3,350 financial mismatch. Two browser visibility/cart tests had not proven hydration and were strengthened.

Expanded 16-case development run: **12 passed, 4 failed**. QA-07 remained confirmed. QA-10 cart interaction and QA-14 login were inconclusive due lack of observed hydration; QA-13 used an incorrect inventory route, subsequently corrected to `/api/inventory`. Final production-build rerun supersedes these numbers for browser conclusions.

No retries hidden in counts; harness corrections were investigated and documented. Final JSON contains the latest run only. Requests never sent real payments, notifications or remote receipt files.

Final **production-build run: 18 tests, 13 passed, 5 failed assertions, 23.7 seconds**. Four failed cases demonstrate confirmed bugs: QA-07 totals, QA-09 corrupt cart, QA-14 external redirect, QA-15 COD email copy. QA-16 mobile browser order submission received 403 due the local Origin mismatch: classify business-journey outcome **BLOCKED**, not a demonstrated production checkout defect. Its confirmation and cart-clear assertions were not reached. QA-13 now passes after checking protected roles using the administrator, not the intentionally role-redacted customer response. QA-10 mobile cart/refresh/checkout entry passes in production build.

Across the latest four test layers: **310 test cases executed, 305 passed, 5 failed assertions**. These aggregate automation counts include mocks/component tests and must not be presented as 310 distinct end-to-end journeys. Of the five final restored-app failures, four are confirmed defects and one environmental blocker. TypeScript and build pass; lint fails separately.

## Environment limitations and evidence safety

Mongo host published port was inaccessible through the internal Docker network; a local-only in-container bridge allowed the fixed-URL native test suite to run. Its first host run failed setup with connection refused (15 unexecuted), not 15 business-test failures. Read-only dependency mount initially prevented Vite config bundling; in-memory runner resolved it. Native suite then passed all 15.

The local ingress initially omitted WebSocket upgrade forwarding and does not preserve Next's internal origin. CLI test requests omit Origin; this does not certify same-origin browser checkout. Browser external hosts are aborted. External-media failures under isolation must not be reported as live broken assets.

Final production browser evidence resolves the earlier hydration limitation: ordinary mobile cart persistence and valid-login interaction execute. Malformed cart and external redirect failures are genuine, not hydration timeouts. Production deployment Origin behavior remains unverified; no live checkout attempted.

Traces and automatic screenshots are disabled to avoid cookies/guest tokens/PII. Only explicitly synthetic screenshots may be retained. No real user documents, payment details, database contents, secrets, cookie/token values or email bodies are included in reports. Temporary restore snapshots and raw local logs must not be committed or shared.

## Artifact links

- [Main report](ecommerce-qa-report.md)
- [Defect register](bug-register.md)
- [Test cases](test-cases.md)
- [Test plan](test-plan.md)
- [Latest restored-app automation JSON](test-artifacts/restored-browser-results.json)
- [Synthetic mobile checkout screenshot](test-artifacts/synthetic-mobile-checkout.png) — visually reviewed; no customer input, real payment destination or token shown.

QA code: `tests/qa/seed-restored.ts`, `tests/qa/restored-app.spec.ts`, `playwright.qa.config.ts`. Start/restore containers only with explicitly local dummy configuration. Do not run the fixture seed on production or an unknown `.env`.

Final integrity check: original restored product documents are unchanged between baseline and working copies; baseline still has zero orders. Working copy has 26 bounded synthetic orders accumulated across investigated test runs. Task-specific QA app/proxy/Mongo services were stopped after testing; containers/data remain local for follow-up and were not deleted. The original backup was never changed. Newly added QA files pass targeted lint after removing an unused test argument; repository-wide baseline lint issues remain.
