/** Standalone reels are explicitly curated in Homepage; linked products must opt in. */
export function isVisibleShoppableReel(reel: { linkedProduct?: unknown }) {
  if (!reel.linkedProduct) return true
  if (typeof reel.linkedProduct !== 'object') return false
  const product = reel.linkedProduct as { showInShopByVideo?: boolean; status?: string; productVideo?: unknown }
  return product.showInShopByVideo === true && product.status === 'published' && Boolean(product.productVideo)
}
