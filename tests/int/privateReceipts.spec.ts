// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const mock = vi.hoisted(() => ({
  send: vi.fn(),
  destroy: vi.fn(),
  configuration: vi.fn(),
  getPayload: vi.fn(),
  auth: vi.fn(),
  findByID: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mock.getPayload }))
vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    S3Client: class {
      constructor(config: unknown) {
        mock.configuration(config)
      }
      send = mock.send
      destroy = mock.destroy
    },
    HeadObjectCommand: class HeadObjectCommand extends Command {},
    PutObjectCommand: class PutObjectCommand extends Command {},
    GetObjectCommand: class GetObjectCommand extends Command {},
  }
})
import { GET, POST } from '@/app/api/orders/[id]/receipt/route'
import {
  readReceipt,
  receiptKey,
  receiptStorage,
  storeReceipt,
  RECEIPT_MAX_BYTES,
} from '@/utilities/privateReceipts'
import { signOrderAccess } from '@/utilities/orderAccess'

const secret = 'isolated-private-receipt-tests'
const context = (id = 'order1') => ({ params: Promise.resolve({ id }) })
const missing = () => Object.assign(new Error('not found'), { $metadata: { httpStatusCode: 404 } })
let image: Buffer
function request(
  method = 'GET',
  options: { token?: string; body?: BodyInit; mime?: string; query?: string; origin?: string } = {},
) {
  return new Request(`https://store.example/api/orders/order1/receipt${options.query || ''}`, {
    method,
    body: options.body,
    headers: {
      Origin: options.origin || 'https://store.example',
      ...(options.token ? { 'x-order-token': options.token } : {}),
      ...(options.mime ? { 'Content-Type': options.mime } : {}),
    },
  })
}
const signed = (options = {}) =>
  request('POST', {
    token: signOrderAccess('order1', secret),
    body: new Uint8Array(image),
    mime: 'image/png',
    ...options,
  })
beforeEach(async () => {
  vi.resetAllMocks()
  vi.stubEnv('R2_BUCKET', 'public-catalog')
  vi.stubEnv('R2_RECEIPTS_BUCKET', 'private-orders')
  vi.stubEnv(
    'R2_RECEIPTS_ENDPOINT',
    'https://00000000000000000000000000000000.r2.cloudflarestorage.com',
  )
  vi.stubEnv('R2_RECEIPTS_ACCESS_KEY_ID', 'dummy-private-key')
  vi.stubEnv('R2_RECEIPTS_SECRET_ACCESS_KEY', 'dummy-private-secret')
  mock.getPayload.mockResolvedValue({
    auth: mock.auth,
    findByID: mock.findByID,
    config: { secret },
  })
  mock.auth.mockResolvedValue({ user: null })
  mock.findByID.mockResolvedValue({
    id: 'order1',
    paymentMethod: 'bank_transfer',
    status: 'pending_verification',
  })
  mock.send.mockImplementation(async (command) => {
    if (command.constructor.name === 'HeadObjectCommand') throw missing()
    if (command.constructor.name === 'GetObjectCommand')
      return {
        ContentLength: 4,
        Body: {
          transformToWebStream: () =>
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array([1, 2, 3, 4]))
                controller.close()
              },
            }),
        },
      }
    return {}
  })
  image = await sharp({ create: { width: 32, height: 48, channels: 3, background: '#fff' } })
    .png()
    .toBuffer()
})
afterEach(() => vi.unstubAllEnvs())

describe('private receipt access and storage', () => {
  it('denies unsigned visitors before reading an order or storage', async () => {
    expect((await GET(request(), context())).status).toBe(404)
    expect((await POST(request('POST'), context())).status).toBe(404)
    expect(mock.findByID).not.toHaveBeenCalled()
    expect(mock.send).not.toHaveBeenCalled()
  })
  it.each(['forged', 'wrong-order', 'expired'])('denies %s guest capability', async (kind) => {
    const token =
      kind === 'forged'
        ? 'not-valid'
        : signOrderAccess(
            kind === 'wrong-order' ? 'order2' : 'order1',
            secret,
            kind === 'expired' ? Date.now() - 8 * 86400000 : Date.now(),
          )
    expect((await GET(request('GET', { token }), context())).status).toBe(404)
    expect(mock.findByID).not.toHaveBeenCalled()
    expect(mock.send).not.toHaveBeenCalled()
  })
  it('rejects path traversal before initializing Payload', async () => {
    expect((await GET(request(), context('../other'))).status).toBe(404)
    expect(mock.getPayload).not.toHaveBeenCalled()
    expect(() => receiptKey('../other')).toThrow()
  })
  it('enforces collection ownership for logged-in accounts rather than matching email', async () => {
    const user = { id: 'user1', roles: ['customer'] }
    mock.auth.mockResolvedValue({ user })
    mock.findByID.mockRejectedValue(new Error('forbidden'))
    expect((await GET(request(), context())).status).toBe(404)
    expect(mock.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ user, overrideAccess: false, depth: 0 }),
    )
    expect(mock.send).not.toHaveBeenCalled()
  })
  it('streams private bytes for authorized admins with no-store and safe image headers', async () => {
    const user = { id: 'admin1', roles: ['admin'] }
    mock.auth.mockResolvedValue({ user })
    const response = await GET(request(), context())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3, 4])
    expect(mock.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ user, overrideAccess: false }),
    )
  })
  it('accepts signed guest image URLs and never sends a public redirect', async () => {
    const response = await GET(
      request('GET', { query: `?token=${signOrderAccess('order1', secret)}` }),
      context(),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Location')).toBeNull()
    expect(mock.findByID).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: true }))
  })
  it('returns only existence/upload capability metadata', async () => {
    const response = await GET(
      request('GET', { token: signOrderAccess('order1', secret), query: '?info=1' }),
      context(),
    )
    expect(await response.json()).toEqual({ exists: false, canUpload: true })
  })
  it('uploads a sanitized WebP to only the private bucket with atomic create-only semantics', async () => {
    expect((await POST(signed(), context())).status).toBe(201)
    const put = mock.send.mock.calls.find(
      ([command]) => command.constructor.name === 'PutObjectCommand',
    )?.[0].input
    expect(put).toMatchObject({
      Bucket: 'private-orders',
      Key: 'order-receipts/v1/order1.webp',
      IfNoneMatch: '*',
      ContentType: 'image/webp',
      CacheControl: 'private, no-store',
    })
    expect((await sharp(put.Body).metadata()).format).toBe('webp')
    expect(mock.configuration).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: { accessKeyId: 'dummy-private-key', secretAccessKey: 'dummy-private-secret' },
      }),
    )
  })
  it('rejects cross-origin uploads before auth or storage', async () => {
    expect((await POST(signed({ origin: 'https://evil.example' }), context())).status).toBe(403)
    expect(mock.getPayload).not.toHaveBeenCalled()
    expect(mock.send).not.toHaveBeenCalled()
  })
  it('uses the canonical database ID for object keys, not a request-path alias', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'user1', roles: ['customer'] } })
    mock.findByID.mockResolvedValue({
      id: 1,
      paymentMethod: 'jazzcash',
      status: 'pending_verification',
    })
    expect((await POST(signed(), context('0001'))).status).toBe(201)
    const put = mock.send.mock.calls.find(
      ([command]) => command.constructor.name === 'PutObjectCommand',
    )?.[0].input
    expect(put.Key).toBe('order-receipts/v1/1.webp')
  })
  it.each(['cod', 'confirmed', 'cancelled', 'admin'])('refuses uploads for %s', async (state) => {
    if (state === 'admin') mock.auth.mockResolvedValue({ user: { id: 'admin1', roles: ['admin'] } })
    else
      mock.findByID.mockResolvedValue({
        id: 'order1',
        paymentMethod: state === 'cod' ? 'cod' : 'bank_transfer',
        status: state === 'cod' ? 'confirmed' : state,
      })
    expect((await POST(signed(), context())).status).toBe(403)
    expect(mock.send).not.toHaveBeenCalled()
  })
  it('rejects an existing receipt instead of replacing it', async () => {
    mock.send.mockResolvedValue({})
    expect((await POST(signed(), context())).status).toBe(409)
    expect(mock.send).toHaveBeenCalledTimes(1)
  })
  it('rejects a competing first upload via the R2 precondition, even after a missing HEAD', async () => {
    mock.send.mockImplementation(async (command) => {
      if (command.constructor.name === 'HeadObjectCommand') throw missing()
      throw Object.assign(new Error('race'), { $metadata: { httpStatusCode: 412 } })
    })
    expect((await POST(signed(), context())).status).toBe(409)
  })
  it('fails closed when private config is blank or points at the public bucket', async () => {
    vi.stubEnv('R2_RECEIPTS_BUCKET', '')
    expect((await POST(signed(), context())).status).toBe(503)
    expect(mock.send).not.toHaveBeenCalled()
    vi.stubEnv('R2_RECEIPTS_BUCKET', 'public-catalog')
    expect(() => receiptStorage()).toThrow('configuration needs review')
  })
  it('does not expose raw storage credentials/provider failures to customers', async () => {
    mock.send.mockRejectedValue(new Error('sensitive provider detail'))
    const response = await POST(signed(), context())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('sensitive provider detail')
  })
  it('returns 404 for a missing private object', async () => {
    mock.send.mockRejectedValue(missing())
    expect(
      (await GET(request('GET', { token: signOrderAccess('order1', secret) }), context())).status,
    ).toBe(404)
  })
})

describe('receipt validation', () => {
  it.each(['image/jpeg', 'image/webp'])(
    'accepts decoded %s and normalizes to WebP',
    async (mime) => {
      const source =
        mime === 'image/jpeg'
          ? await sharp(image).jpeg().toBuffer()
          : await sharp(image).webp().toBuffer()
      const output = await readReceipt(request('POST', { body: new Uint8Array(source), mime }))
      expect((await sharp(output).metadata()).format).toBe('webp')
    },
  )
  it.each(['image/svg+xml', 'application/pdf', 'application/octet-stream'])(
    'rejects %s',
    async (mime) => {
      await expect(
        readReceipt(request('POST', { body: new Uint8Array(image), mime })),
      ).rejects.toMatchObject({ status: 415 })
    },
  )
  it('rejects spoofed types, corrupt files, and empty bodies', async () => {
    await expect(
      readReceipt(request('POST', { body: new Uint8Array(image), mime: 'image/jpeg' })),
    ).rejects.toThrow('Invalid receipt image')
    await expect(
      readReceipt(request('POST', { body: '<script>not image</script>', mime: 'image/png' })),
    ).rejects.toThrow('Invalid receipt image')
    await expect(
      readReceipt(request('POST', { body: new Uint8Array(0), mime: 'image/png' })),
    ).rejects.toThrow('required')
  })
  it('caps streamed bytes without trusting Content-Length', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(RECEIPT_MAX_BYTES))
        controller.enqueue(new Uint8Array(1))
        controller.close()
      },
    })
    const req = new Request('https://store.example', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: stream,
      duplex: 'half',
    } as RequestInit)
    await expect(readReceipt(req)).rejects.toMatchObject({ status: 413 })
  })
  it('rejects images over the pixel limit', async () => {
    const source = await sharp({
      create: { width: 4100, height: 4100, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer()
    await expect(
      readReceipt(request('POST', { body: new Uint8Array(source), mime: 'image/png' })),
    ).rejects.toThrow('Invalid receipt image')
  })
  it('does not silently replace receipts on a conditional write conflict', async () => {
    mock.send.mockRejectedValue(
      Object.assign(new Error('conflict'), { $metadata: { httpStatusCode: 409 } }),
    )
    await expect(storeReceipt('order1', image)).rejects.toMatchObject({ status: 409 })
  })
})
