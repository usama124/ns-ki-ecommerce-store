# MongoDB connection management — 28 October 2026

## What changed

Payload's existing global getPayload cache is retained. No extra MongoClient, request
disconnect, transaction serialization, or database index changes are introduced.
The MongoDB adapter's `afterOpenConnection` hook registers its actual driver client
with the official `@vercel/functions` `attachDatabasePool` helper. A global weak-keyed
registry prevents duplicate registration/listeners across repeated hooks or HMR.
Local/CLI/build processes without Vercel's request-runtime environment do not attach.
Node 20.9+ is now declared (the Vercel package requires Node 20+); checks used Node 22.

The SDK extends request lifetime so the driver's idle expiry can run before the
function suspends; it is NOT a proxy or a deployment-wide connection limiter. It
does not close the client or terminate transactions per request. Monitoring sockets
are separate from pooled application sockets and may stay open. Verify Fluid Compute
and account for the additional background invocation duration in Vercel observability.

Source: [Vercel pool lifecycle API](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool),
[MongoDB driver pooling](https://www.mongodb.com/docs/drivers/node/v6.x/connect/connection-options/connection-pools/).

## Environment settings and precedence

- MongoDB local/production default: `DB_POOL_MAX=5` unless explicitly configured.
- Vercel Preview: `DB_POOL_MAX_PREVIEW` takes priority. When absent/invalid,
  maximum is `min(valid DB_POOL_MAX or 5, 2)`. Thus the existing preview shared
  `DB_POOL_MAX=10` now results in **2**, not 10. A shared maximum of 1 stays 1.
- Production's explicitly configured `DB_POOL_MAX=10` remains 10; decide production
  limits from measured throughput and the number of warm instances, not user count.
- `minPoolSize=0` always. Vercel opens at most one new application socket per pool
  at a time (`maxConnecting=1`); local default is at most two.
- Idle expiry defaults to 10 seconds on Vercel, 30 seconds locally. Optional
  `DB_MAX_IDLE_TIME_MS` overrides this. Connection/selection/queue waits still use
  `DB_CONNECT_TIMEOUT_MS` (default 10 seconds), providing bounded queue waits.
- PostgreSQL retains its prior settings and is unaffected by the new preview knob.

Recommended initial **preview** rollout settings:

```dotenv
DB_POOL_MAX_PREVIEW=2
DB_MAX_IDLE_TIME_MS=10000
DB_POOL_DIAGNOSTICS=true
```

Changing Vercel environment values requires redeployment. Deploy the code too; the
new preview override has no effect on older deployments. Do not increase pool size
to mask checkout timeouts before checking slow operations and instance counts.
Do not set a low socketTimeoutMS or disconnect per response; either can break valid
queries/transactions. No connection URL or account secret needs changing for this fix.

## Diagnostics

Set `DB_POOL_DIAGNOSTICS=true` temporarily to enable `[mongo-pool]` structured logs:

- `client_observed`: random per-client instance identifier, safe deployment appName,
  pool sizes/idle limit, and whether SDK lifecycle registration succeeded.
- `pool_events`: counts of driver pool/connection creation/closure/clearing events
  **observed since the hook**, emitted at most once per 10 seconds when events occur.
- `checkout_failed`: observed checkout failures, rate-limited to once per 30 seconds.
- `lifecycle_attach_failed`: sanitized warning if registration fails; the bounded
  driver pool stays usable. Investigate this warning instead of assuming cleanup works.

The connection-string hostname, credentials, query/command bodies, driver event
payloads and raw errors are not recorded. Diagnostic logger failures cannot break
MongoDB operations. `appName` includes the environment and a bounded sanitized
deployment ID (or commit), making client ownership easier to distinguish in Atlas.

Important limits: initial sockets opened before `afterOpenConnection` are not counted
by these listeners. Counts are event deltas, NOT a complete live-socket gauge. SDK
registration success is NOT proof of suspension cleanup. Quiet periods produce no
new summary (there is deliberately no logging interval). Correlate with Atlas metrics
and Vercel deployment/instance logs; do not equate web visitors with DB clients.

## Verification and release gate

Unit tests cover existing-preview-10 precedence, lower/larger explicit overrides,
production/Postgres compatibility, invalid values, timeouts, deployment labels,
one-time registration, local/build exclusion, sanitized logs, failure containment,
and repeated hook calls. Existing checkout, transaction, private receipt, analytics
and reporting tests must continue to pass.

An optional **localhost-only** smoke test is available. It replaces process.env with
dummy configuration (does not load `.env`), uses only `127.0.0.1:27148/nski_pool_smoke`,
and writes only an aborted transaction probe in that disposable database. Start a
disposable MongoDB replica set on that port and initialize it as rs0, then run:

```bash
node --no-experimental-strip-types --import tsx scripts/check-local-mongo-pool.ts --local-pool-check
```

It checks concurrent Payload reuse, 24 concurrent pings through a pool capped at 2,
transaction rollback, observed idle connection closure and successful reuse afterward.
This test does not simulate multiple Vercel instances, Atlas topology or suspension.

Before production, deploy to the dedicated preview cluster, verify the effective cap
and lifecycle-registration log, and test a controlled browse/admin/checkout workload.
Record warm client count, Atlas connections per relevant node, peak checked-out
sockets, request latency, timeout rate and idle recovery. Verify old preview URLs,
local processes, database tools and overlapping deploys aren't also connecting.
Then perform a staged concurrency test using synthetic orders, monitoring stock
integrity and email side effects. Leave capacity headroom for monitoring, admin,
jobs and deployment overlap. Disable diagnostic logging once ownership is understood.

These changes reduce per-instance pressure and improve idle expiry; they cannot
guarantee a global 500-connection ceiling under unlimited instance scaling. No
production capacity sign-off or automatic Vercel/database deployment is implied.

## Completed local verification

- **606 tests passed in 54 files**, including the real pinned Vercel SDK test:
  a MongoDB checkout registers waitUntil through idle expiry without closing the client.
- Full TypeScript check, targeted ESLint and `git diff --check` passed.
- Real Payload/MongoDB 7 replica-set smoke test passed twice: 12 concurrent getPayload
  calls reused 1 Payload instance; 24 concurrent pings peaked at 2 checked-out sockets;
  2 idle application-connection closures were observed; rollback and reuse after
  idle expiry both passed. The test used a 250 ms idle override for fast verification,
  not the 10-second Vercel default.
- The disposable test container and its synthetic database were removed afterward.
  No remote database, Vercel setting or production deployment was modified. The
  downloaded Docker image remains available as a local cache.
- A fresh production build and real Vercel suspension/Atlas measurements have not
  been performed. Follow the preview release gate above before claiming capacity.
