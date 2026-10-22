import { describe, expect, it } from 'vitest'
import { categoryBranchIds, categoryProductFilter } from '@/utilities/categoryProductFilter'

const categories = [
  { id: 'winter', parent: null },
  { id: 'khaddar', parent: 'winter' },
  { id: 'velvet', parent: 'winter' },
  { id: 'embroidered', parent: 'velvet' },
  { id: 'summer', parent: null },
  { id: 'lawn', parent: 'summer' },
]
describe('Category product hierarchy', () => {
  it('includes the parent, both subcategories and further descendants', () => {
    expect(categoryBranchIds(categories, 'winter')).toEqual(['winter', 'khaddar', 'velvet', 'embroidered'])
  })
  it('keeps sibling and unrelated branches out of a subcategory page', () => {
    expect(categoryBranchIds(categories, 'velvet')).toEqual(['velvet', 'embroidered'])
    expect(categoryBranchIds(categories, 'khaddar')).toEqual(['khaddar'])
  })
  it('supports populated parent objects and mixed string/numeric IDs', () => {
    expect(categoryBranchIds([{ id: 1 }, { id: 2, parent: { id: '1' } }, { id: 3, parent: '2' }], 1)).toEqual([1, 2, 3])
  })
  it('does not loop or duplicate IDs on malformed/cyclic category links', () => {
    expect(categoryBranchIds([{ id: 1, parent: 2 }, { id: 2, parent: 1 }, { id: 2, parent: 1 }], 1)).toEqual([1, 2])
  })
  it('does not include orphan categories or traverse upwards', () => {
    expect(categoryBranchIds([...categories, { id: 'orphan', parent: 'deleted' }], 'summer')).toEqual(['summer', 'lawn'])
    expect(categoryBranchIds(categories, 'embroidered')).toEqual(['embroidered'])
  })
  it('matches either assigned categories or primary category without duplicating product queries', () => {
    expect(categoryProductFilter(categories, 'winter')).toEqual({ or: [
      { categories: { in: ['winter', 'khaddar', 'velvet', 'embroidered'] } },
      { primaryCategory: { in: ['winter', 'khaddar', 'velvet', 'embroidered'] } },
    ] })
  })
})
