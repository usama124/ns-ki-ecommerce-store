# Category product listings

Both `/shop/[category]` and `/shop?category=...` resolve the selected category by ID or slug and include its entire descendant branch. Products directly assigned to the selected category are included too. Matching either Assigned Categories & Collections or Primary Category qualifies a product. The existing published-only constraint remains in place; a subcategory never expands upwards into its parent or sideways into siblings.

For example, set the **Parent** of Khaddar and Velvet to Winter Collection in **Shop → Categories**. Assign each product to the appropriate subcategory. Winter Collection then displays both groups without requiring a second manual assignment on every product. Products assigned to several matching categories appear once because the filtering is performed in one product query, not by merging separate lists.

The hierarchy comes from the existing cached category list. No extra database request is made per subcategory, no product records are rewritten, and no migration or environment setting is needed. Existing category-change cache invalidation applies. The tree traversal also handles deeper descendants and guards against cycles/duplicate IDs.

Listings retain their 50-products-per-page limit and now expose Previous/Next navigation so larger branches are not silently truncated. Links preserve the selected category, search and sorting parameters. The all-products shop continues to work without a category filter.

Regression tests cover parent/child isolation, direct parent assignments, primary category matches, mixed ID types, populated parents, missing parents, cycles, publication filtering, duplicate assignments, both shop routes, sorting/search preservation, missing-category 404s and pagination links.
