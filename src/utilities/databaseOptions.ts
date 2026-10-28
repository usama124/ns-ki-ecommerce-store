function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

// Pools are per warm application instance; budget fleet-wide connections against
// the database's limit and deployment concurrency.
export function getDatabaseOptions(env: Record<string, string | undefined>) {
  const timeout = positiveInteger(env.DB_CONNECT_TIMEOUT_MS, 10000)
  const sharedMaximum = positiveInteger(env.DB_POOL_MAX, 5)
  // Old previews commonly inherit DB_POOL_MAX=10. Keep them small unless a
  // separate, deliberate preview override is supplied; this is NOT a fleet cap.
  const preview = env.VERCEL_ENV === 'preview'
  const vercel = env.VERCEL === '1' || preview || env.VERCEL_ENV === 'production'
  const mongoMaximum = preview
    ? positiveInteger(env.DB_POOL_MAX_PREVIEW, Math.min(sharedMaximum, 2))
    : sharedMaximum
  const deployment = (env.VERCEL_DEPLOYMENT_ID || env.VERCEL_GIT_COMMIT_SHA || '')
    .replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
  const environment = preview ? 'preview' : vercel ? 'production' : 'local'
  return {
    mongo: {
      maxPoolSize: mongoMaximum,
      minPoolSize: 0,
      maxConnecting: Math.min(mongoMaximum, vercel ? 1 : 2),
      maxIdleTimeMS: positiveInteger(env.DB_MAX_IDLE_TIME_MS, vercel ? 10000 : 30000),
      serverSelectionTimeoutMS: timeout,
      connectTimeoutMS: timeout,
      waitQueueTimeoutMS: timeout,
      appName: `nski-${environment}${deployment ? `-${deployment}` : ''}`,
    },
    postgres: {
      max: positiveInteger(env.DB_POOL_MAX, 5),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: timeout,
    },
  }
}
