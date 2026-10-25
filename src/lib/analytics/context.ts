/** Shared, deliberately narrow wire format. No cookies are parsed for GA IDs. */
export type OrderAnalyticsContext = {
  consent: 'granted'
  clientId: string
  sessionId: string
  token: string
}
export function parseAnalyticsContext(value: unknown): OrderAnalyticsContext | undefined {
  if (!value || typeof value !== 'object') return
  const input = value as Record<string, unknown>
  if (
    input.consent !== 'granted' ||
    typeof input.clientId !== 'string' ||
    !/^\d{1,20}\.\d{1,20}$/.test(input.clientId) ||
    typeof input.sessionId !== 'string' ||
    !/^[1-9]\d{0,14}$/.test(input.sessionId) ||
    typeof input.token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.token)
  )
    return
  return {
    consent: 'granted',
    clientId: input.clientId,
    sessionId: input.sessionId,
    token: input.token,
  }
}
