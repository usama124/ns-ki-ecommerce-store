// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSameOrigin } from '@/utilities/apiSecurity'

const envKeys = ['NEXT_PUBLIC_SERVER_URL', 'PAYLOAD_PUBLIC_SERVER_URL', 'VERCEL', 'VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'APP_TRUSTED_ORIGINS']
beforeEach(() => { for (const key of envKeys) vi.stubEnv(key, '') })
afterEach(() => vi.unstubAllEnvs())
function request(origin?: string, extras: Record<string, string> = {}, url = 'http://0.0.0.0:3000/api/orders') {
  return new Request(url, { method: 'POST', headers: { ...(origin === undefined ? {} : { Origin: origin }), ...extras } })
}
function preview() {
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://www.siblingsbynski.com')
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('VERCEL_URL', 'nski-deploy123.vercel.app')
  vi.stubEnv('VERCEL_BRANCH_URL', 'nski-git-develop-team.vercel.app')
}
describe('exact trusted request origins', () => {
  it.each(['https://www.siblingsbynski.com', 'https://nski-deploy123.vercel.app', 'https://nski-git-develop-team.vercel.app'])(
    'allows the configured/platform origin %s behind an internal proxy URL', origin => {
      preview()
      expect(() => requireSameOrigin(request(origin, { 'sec-fetch-site': 'same-origin' }))).not.toThrow()
    },
  )
  it.each(['https://attacker.example', 'https://other-team.vercel.app', 'https://nski-deploy123.vercel.app.attacker.example', 'http://nski-deploy123.vercel.app', 'https://nski-deploy123.vercel.app:444', 'null', 'https://www.siblingsbynski.com/path', ''])('rejects untrusted/malformed origin %s', origin => {
    preview()
    expect(() => requireSameOrigin(request(origin))).toThrow(expect.objectContaining({ status: 403 }))
  })
  it('does not trust a spoofed Host, forwarded host/protocol or caller-controlled request URL', () => {
    preview()
    const malicious = request('https://attacker.example', {
      host: 'attacker.example', 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https',
      'sec-fetch-site': 'same-origin',
    }, 'https://attacker.example/api/orders')
    expect(() => requireSameOrigin(malicious)).toThrow(expect.objectContaining({ status: 403 }))
  })
  it('rejects explicitly cross-site requests even if the Origin claims to be trusted', () => {
    preview()
    expect(() => requireSameOrigin(request('https://nski-deploy123.vercel.app', { 'sec-fetch-site': 'cross-site' }))).toThrow(expect.objectContaining({ status: 403 }))
    expect(() => requireSameOrigin(request(undefined, { 'sec-fetch-site': 'cross-site' }))).toThrow(expect.objectContaining({ status: 403 }))
  })
  it('does not trust Vercel-like environment values outside the Vercel runtime', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://store.example')
    vi.stubEnv('VERCEL_URL', 'attacker.vercel.app')
    expect(() => requireSameOrigin(request('https://attacker.vercel.app'))).toThrow(expect.objectContaining({ status: 403 }))
  })
  it('supports explicit custom preview and www/apex aliases without broad subdomain matching', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://siblingsbynski.com')
    vi.stubEnv('APP_TRUSTED_ORIGINS', ' https://staging.example.com, https://www.siblingsbynski.com, ')
    for (const origin of ['https://siblingsbynski.com', 'https://www.siblingsbynski.com', 'https://staging.example.com']) {
      expect(() => requireSameOrigin(request(origin))).not.toThrow()
    }
    expect(() => requireSameOrigin(request('https://other.staging.example.com'))).toThrow(expect.objectContaining({ status: 403 }))
  })
  it.each(['*', 'https://*.vercel.app', 'javascript:alert(1)', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com?query=1', 'https://example.com#hash'])('fails closed for invalid explicit alias %s', alias => {
    vi.stubEnv('APP_TRUSTED_ORIGINS', alias)
    expect(() => requireSameOrigin(request('https://example.com'))).toThrow(expect.objectContaining({ status: 503 }))
  })
  it.each(['bad-url', 'javascript:alert(1)', 'https://user:secret@example.com'])('fails closed for invalid canonical configuration %s', value => {
    preview()
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', value)
    expect(() => requireSameOrigin(request('https://nski-deploy123.vercel.app'))).toThrow(expect.objectContaining({ status: 503 }))
  })
  it.each(['https://wrong.example', 'user@wrong.example', 'wrong.example/path', 'wrong.example?x=1', '*.vercel.app'])('fails closed for invalid platform hostname %s', value => {
    preview()
    vi.stubEnv('VERCEL_URL', value)
    expect(() => requireSameOrigin(request('https://wrong.example'))).toThrow(expect.objectContaining({ status: 503 }))
  })
  it('retains local origin fallback and canonical fallback variable', () => {
    expect(() => requireSameOrigin(request('http://localhost:3000', {}, 'http://localhost:3000/api/orders'))).not.toThrow()
    vi.stubEnv('PAYLOAD_PUBLIC_SERVER_URL', 'https://store.example')
    expect(() => requireSameOrigin(request('https://store.example'))).not.toThrow()
    expect(() => requireSameOrigin(request('http://localhost:3000', {}, 'http://localhost:3000/api/orders'))).toThrow(expect.objectContaining({ status: 403 }))
  })
  it('preserves Origin-less API clients, which still need endpoint authentication/capabilities', () => {
    preview()
    expect(() => requireSameOrigin(request())).not.toThrow()
  })
})
