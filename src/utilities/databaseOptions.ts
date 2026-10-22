function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

// Pools are per warm application instance; budget fleet-wide connections against
// the database's limit and deployment concurrency.
export function getDatabaseOptions(env: Record<string, string | undefined>) {
  const timeout = positiveInteger(env.DB_CONNECT_TIMEOUT_MS, 10000)
  return {
    mongo: {
      maxPoolSize: positiveInteger(env.DB_POOL_MAX, 10),
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: timeout,
      connectTimeoutMS: timeout,
      waitQueueTimeoutMS: timeout,
    },
    postgres: {
      max: positiveInteger(env.DB_POOL_MAX, 5),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: timeout,
    },
  }
}
