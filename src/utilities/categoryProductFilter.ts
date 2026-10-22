import type { Where } from 'payload'

type ID = string | number
type CategoryNode = { id: ID; parent?: ID | { id: ID } | null }

/** Walk the cached category tree once, without an extra DB query per child. */
export function categoryBranchIds(categories: readonly CategoryNode[], rootId: ID): ID[] {
  const children = new Map<string, ID[]>()
  for (const category of categories) {
    const parent = typeof category.parent === 'object' ? category.parent?.id : category.parent
    if (parent === undefined || parent === null) continue
    const key = String(parent)
    const group = children.get(key) || []
    group.push(category.id)
    children.set(key, group)
  }
  const ids: ID[] = [rootId]
  const visited = new Set([String(rootId)])
  for (let index = 0; index < ids.length; index++) {
    for (const child of children.get(String(ids[index])) || []) {
      if (visited.has(String(child))) continue
      visited.add(String(child))
      ids.push(child)
    }
  }
  return ids
}

export function categoryProductFilter(categories: readonly CategoryNode[], rootId: ID): Where {
  const ids = categoryBranchIds(categories, rootId)
  return { or: [{ categories: { in: ids } }, { primaryCategory: { in: ids } }] }
}
