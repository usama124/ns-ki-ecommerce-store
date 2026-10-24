import { NextResponse } from 'next/server'
import { checkRole } from '@/access/utilities'

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
  }
}

export function validDocumentID(value: unknown): value is string | number {
  return typeof value === 'number'
    ? Number.isSafeInteger(value) && value > 0
    : typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value)
}

export function privateJSON(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

export function requestError(error: unknown) {
  if (error instanceof RequestError) {
    const response = privateJSON({ error: error.message }, error.status)
    if (error.status === 429) response.headers.set('Retry-After', '900')
    return response
  }
  // Do not return database/provider errors or log request bodies/customer data.
  return privateJSON({ error: 'The request could not be completed. Please try again.' }, 503)
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  if (site === 'cross-site' || (origin && origin !== new URL(request.url).origin)) {
    throw new RequestError('Cross-origin requests are not allowed.', 403)
  }
  // Origin may be absent for CLI/API clients. They must still pass authentication
  // and authorization; an Origin header is never used as an identity credential.
}

export async function requireAdmin(request: Request) {
  const [{ default: config }, { getPayload }] = await Promise.all([import('@payload-config'), import('payload')])
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) throw new RequestError('Please log in.', 401)
  if (!checkRole(['admin'], user)) throw new RequestError('Action forbidden.', 403)
  if (!['GET', 'HEAD'].includes(request.method)) requireSameOrigin(request)
  return { payload, user, overrideAccess: false as const }
}

/** Bound the bytes actually read, including requests without Content-Length. */
export async function readJSON(
  request: Request,
  limit = 64 * 1024,
): Promise<Record<string, unknown>> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    throw new RequestError('Expected application/json.', 415)
  }
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError('A request body is required.')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > limit) {
        await reader.cancel()
        throw new RequestError('Request body is too large.', 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error()
    return body
  } catch {
    throw new RequestError('Invalid JSON body.')
  }
}
