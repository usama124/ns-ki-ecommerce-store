import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { RequestError, validDocumentID } from './apiSecurity'

export const RECEIPT_MAX_BYTES = 3 * 1024 * 1024
const formats: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Never fall back to public-media credentials, bucket, or URLs.
export function receiptStorage() {
  const bucket = process.env.R2_RECEIPTS_BUCKET?.trim()
  const endpoint = process.env.R2_RECEIPTS_ENDPOINT?.trim()
  const accessKeyId = process.env.R2_RECEIPTS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_RECEIPTS_SECRET_ACCESS_KEY?.trim()
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey)
    throw new RequestError(
      'Private receipt storage is not configured yet. Your payment reference can still be verified.',
      503,
    )
  if (
    bucket === process.env.R2_BUCKET ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    !/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/.test(endpoint)
  )
    throw new RequestError('Private receipt storage configuration needs review.', 503)
  return {
    bucket,
    client: new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  }
}

// No names, emails, user-provided filenames, or arbitrary object keys are accepted.
export const receiptKey = (id: string | number) => {
  if (!validDocumentID(id)) throw new RequestError('Invalid order identifier.')
  return `order-receipts/v1/${id}.webp`
}
const isMissing = (error: unknown) =>
  (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404

export async function receiptExists(id: string | number) {
  const { client, bucket } = receiptStorage()
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: receiptKey(id) }), {
      abortSignal: AbortSignal.timeout(15000),
    })
    return true
  } catch (error) {
    if (isMissing(error)) return false
    throw error
  } finally {
    client.destroy()
  }
}

/** Read actual streamed bytes; Content-Length is not trusted. Raw image, not multipart. */
export async function readReceipt(request: Request) {
  const mime = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || ''
  if (!formats[mime]) throw new RequestError('Please upload a JPEG, PNG or WebP image.', 415)
  if (Number(request.headers.get('content-length')) > RECEIPT_MAX_BYTES)
    throw new RequestError('Receipt must be 3 MB or smaller.', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError('A receipt image is required.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > RECEIPT_MAX_BYTES) {
        await reader.cancel()
        throw new RequestError('Receipt must be 3 MB or smaller.', 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (!size) throw new RequestError('A receipt image is required.')
  try {
    const source = sharp(Buffer.concat(chunks), { limitInputPixels: 16_000_000, failOn: 'warning' })
    const info = await source.metadata()
    if (
      info.format !== formats[mime] ||
      (info.pages || 1) !== 1 ||
      !info.width ||
      !info.height ||
      info.width > 8000 ||
      info.height > 8000
    )
      throw new Error('Invalid image')
    // Decode/re-encode to strip metadata and reject renamed/active/malformed files.
    const image = await source
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer()
    if (image.length > RECEIPT_MAX_BYTES) throw new Error('Encoded image too large')
    return image
  } catch {
    throw new RequestError(
      'Invalid receipt image. Use a non-animated JPEG, PNG or WebP under 16 megapixels.',
    )
  }
}

export async function storeReceipt(id: string | number, image: Buffer) {
  const { client, bucket } = receiptStorage()
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: receiptKey(id),
        Body: image,
        ContentType: 'image/webp',
        CacheControl: 'private, no-store',
        IfNoneMatch: '*',
      }),
      { abortSignal: AbortSignal.timeout(15000) },
    )
  } catch (error) {
    if (
      [409, 412].includes(
        (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode || 0,
      )
    )
      throw new RequestError(
        'A receipt is already attached. Contact support if it needs correcting.',
        409,
      )
    throw error
  } finally {
    client.destroy()
  }
}

export async function loadReceipt(id: string | number) {
  const { client, bucket } = receiptStorage()
  try {
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: receiptKey(id) }),
      { abortSignal: AbortSignal.timeout(15000) },
    )
    if (!object.Body || !object.ContentLength || object.ContentLength > RECEIPT_MAX_BYTES)
      throw new Error('Invalid stored receipt')
    const reader = object.Body.transformToWebStream().getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > RECEIPT_MAX_BYTES) {
          await reader.cancel()
          throw new Error('Stored receipt too large')
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    return Buffer.concat(chunks)
  } catch (error) {
    if (isMissing(error)) throw new RequestError('No receipt attached.', 404)
    throw error
  } finally {
    client.destroy()
  }
}
