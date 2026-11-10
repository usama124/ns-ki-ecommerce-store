import { readJSON, RequestError } from './apiSecurity'
import { RECEIPT_MAX_BYTES, readReceipt, receiptExists, receiptStorage, storeReceipt } from './privateReceipts'

/** Bounded multipart input: never buffer an unbounded formData() request. */
export async function readCheckoutRequest(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;'))
    return { body: await readJSON(request), receipt: null }
  const maximum = RECEIPT_MAX_BYTES + 128 * 1024
  if (Number(request.headers.get('content-length')) > maximum) throw new RequestError('Checkout upload is too large.', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError('Checkout details are required.')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maximum) {
        await reader.cancel()
        throw new RequestError('Checkout upload is too large.', 413)
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let form: FormData
  try {
    form = await new Request(request.url, {
      method: 'POST', headers: { 'Content-Type': request.headers.get('content-type')! },
      body: new Uint8Array(Buffer.concat(chunks)),
    }).formData()
  } catch { throw new RequestError('Invalid checkout upload.') }
  if (form.getAll('checkout').length !== 1 || form.getAll('receipt').length !== 1 || [...form.keys()].some(key => !['checkout', 'receipt'].includes(key)))
    throw new RequestError('Provide checkout details and one receipt image.')
  const json = form.get('checkout'), receipt = form.get('receipt')
  if (typeof json !== 'string' || Buffer.byteLength(json) > 64 * 1024 || !receipt || typeof receipt === 'string')
    throw new RequestError('Invalid checkout details or receipt.')
  let body: Record<string, unknown>
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    body = parsed
  } catch { throw new RequestError('Invalid checkout details.') }
  return { body, receipt }
}

export async function validateCheckoutReceipt(receipt: File) {
  // Fail before creating an order if the private storage configuration is absent.
  const storage = receiptStorage()
  storage.client.destroy()
  return readReceipt(new Request('https://receipt.invalid', {
    method: 'POST', headers: { 'Content-Type': receipt.type, 'Content-Length': String(receipt.size) },
    body: new Uint8Array(await receipt.arrayBuffer()),
  }))
}

/** A retry can find the previous upload even if its success response was lost. */
export async function attachCheckoutReceipt(orderId: string | number, image: Buffer) {
  if (await receiptExists(orderId)) return
  try { await storeReceipt(orderId, image) }
  catch (error) {
    // Concurrent retries may win the conditional write. Never overwrite proof.
    if (error instanceof RequestError && error.status === 409 && await receiptExists(orderId)) return
    throw error
  }
}
