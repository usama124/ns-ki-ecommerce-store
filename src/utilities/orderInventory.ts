import type { PayloadRequest } from 'payload'
import { COMMERCE, commerceSession, mongoCommerce, type InternalRecord } from './commerceDatabase'
import { RequestError } from './apiSecurity'

type Line = {
  product: string | number | { id: string | number }
  variantSize: string
  quantity: number
}
type Allocation = {
  productId: string
  variantId: string
  quantity: number
  deducted: number
  backordered: number
}
export type InventoryState = {
  version: 1
  sequence: number
  active: boolean
  allocations: Allocation[]
}
type OrderInventoryDoc = {
  id?: string | number
  status?: string
  items?: Line[] | null
  inventoryState?: unknown
}
const productId = (line: Line) =>
  String(typeof line.product === 'object' ? line.product.id : line.product)
const signature = (items: Line[] = []) =>
  JSON.stringify(
    items
      .map((line) => [productId(line), line.variantSize.trim().toLowerCase(), line.quantity])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  )

function stateOf(doc?: OrderInventoryDoc): InventoryState | undefined {
  const value = doc?.inventoryState as InventoryState | undefined
  return value?.version === 1 && Array.isArray(value.allocations) ? value : undefined
}

async function restore(allocations: Allocation[], req: PayloadRequest) {
  for (const allocation of allocations) {
    const product = await req.payload.findByID({
      collection: 'products',
      id: allocation.productId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const variants = product?.variants
    const index =
      variants?.findIndex((variant) => String(variant.id) === allocation.variantId) ?? -1
    if (!variants || index < 0)
      throw new RequestError(
        'A reserved product variant was removed. Stock needs manual reconciliation.',
        409,
      )
    const current = variants[index].stock ?? 0
    if (!Number.isSafeInteger(current) || current < 0 || current + allocation.deducted > 1_000_000)
      throw new RequestError('Stock needs manual reconciliation.', 409)
    // Restore ONLY units actually taken from stock, never backordered units.
    const updated = variants.map((variant, position) => ({
      ...variant,
      size: typeof variant.size === 'object' && variant.size ? variant.size.id : variant.size,
      stock: position === index ? current + allocation.deducted : variant.stock,
    }))
    await req.payload.update({
      collection: 'products',
      id: allocation.productId,
      data: { variants: updated },
      overrideAccess: true,
      req,
      context: { skipShoppableVideoSync: true },
    })
  }
}

async function allocate(items: Line[], req: PayloadRequest): Promise<Allocation[]> {
  if (!items.length || items.length > 50)
    throw new RequestError('An order requires 1–50 valid items.')
  const grouped = new Map<string, Line>()
  for (const line of items) {
    if (
      !line.product ||
      typeof line.variantSize !== 'string' ||
      !line.variantSize.trim() ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99
    )
      throw new RequestError('Invalid order item or quantity.')
    const key = `${productId(line)}:${line.variantSize.trim().toLowerCase()}`
    const quantity = (grouped.get(key)?.quantity || 0) + line.quantity
    if (quantity > 99) throw new RequestError('Maximum quantity per variant is 99.')
    grouped.set(key, { ...line, quantity })
  }
  const allocations: Allocation[] = []
  const sizes = await req.payload.find({
    collection: 'sizes',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const sizeMap = new Map(sizes.docs.map((size) => [String(size.id), size]))
  // Deterministic ordering reduces multi-product transaction contention.
  for (const [, line] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    const product = await req.payload.findByID({
      collection: 'products',
      id: productId(line),
      depth: 0,
      req,
      overrideAccess: true,
    })
    const matches = product?.variants?.filter((variant) => {
      const size =
        typeof variant.size === 'object' ? variant.size : sizeMap.get(String(variant.size))
      return (
        typeof size === 'object' &&
        size &&
        [String(size.id), size.name].some(
          (value) => value?.trim().toLowerCase() === line.variantSize.trim().toLowerCase(),
        )
      )
    })
    if (product?.status !== 'published' || matches?.length !== 1 || !matches[0].id)
      throw new RequestError('Selected product size is unavailable.', 409)
    const variant = matches[0]
    const current = variant.stock ?? 0
    if (
      !Number.isSafeInteger(current) ||
      current < 0 ||
      (!variant.allowBackorder && current < line.quantity)
    )
      throw new RequestError('Insufficient stock for a selected size.', 409)
    // Another name/ID alias for the same variant must not bypass the quantity cap.
    const existing = allocations.find(
      (entry) => entry.productId === String(product.id) && entry.variantId === String(variant.id),
    )
    if ((existing?.quantity || 0) + line.quantity > 99)
      throw new RequestError('Maximum quantity per variant is 99.')
    const deducted = Math.min(current, line.quantity)
    const updated = product.variants!.map((entry) => ({
      ...entry,
      size: typeof entry.size === 'object' && entry.size ? entry.size.id : entry.size,
      stock: entry.id === variant.id ? current - deducted : entry.stock,
    }))
    // Snapshot reads + a write to the same Mongo document conflict atomically
    // against another checkout/admin writer. No process-local lock is involved.
    await req.payload.update({
      collection: 'products',
      id: product.id,
      data: { variants: updated },
      req,
      overrideAccess: true,
      context: { skipShoppableVideoSync: true },
    })
    if (existing) {
      existing.quantity += line.quantity
      existing.deducted += deducted
      existing.backordered += line.quantity - deducted
    } else
      allocations.push({
        productId: String(product.id),
        variantId: String(variant.id),
        quantity: line.quantity,
        deducted,
        backordered: line.quantity - deducted,
      })
  }
  return allocations
}

/** All reads, stock changes, order state and movement events share one session. */
export async function reconcileOrderInventory(
  data: OrderInventoryDoc,
  original: OrderInventoryDoc | undefined,
  req: PayloadRequest,
) {
  await commerceSession(req)
  const previous = stateOf(original)
  const active = (data.status || original?.status) !== 'cancelled'
  const changedItems =
    data.items !== undefined && signature(data.items || []) !== signature(original?.items || [])
  if (original && !previous) {
    if (changedItems || (original.status !== 'cancelled') !== active)
      throw new RequestError(
        'This legacy order needs stock reconciliation before changing items or cancellation state.',
        409,
      )
    return undefined
  }
  if (previous && previous.active === active && !changedItems) return previous
  if (previous?.active) await restore(previous.allocations, req)
  const allocations = active ? await allocate(data.items || original?.items || [], req) : []
  return {
    version: 1,
    sequence: (previous?.sequence || 0) + 1,
    active,
    allocations,
  } satisfies InventoryState
}

export async function recordInventoryMovement(
  doc: OrderInventoryDoc,
  previous: OrderInventoryDoc | undefined,
  req: PayloadRequest,
) {
  const state = stateOf(doc)
  const before = stateOf(previous)
  if (!state || state.sequence === before?.sequence) return
  const session = await commerceSession(req)
  await mongoCommerce(req.payload)
    .db.collection<InternalRecord>(COMMERCE.movements)
    .insertOne(
      {
        _id: `${doc.id}:${state.sequence}`,
        orderId: String(doc.id),
        createdAt: new Date(),
        before: before || null,
        after: state,
      },
      { session },
    )
}
