import Link from 'next/link'

export function productPage(value?: string) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1
}

export function ProductPagination({ page, totalPages, pathname, query }: {
  page: number
  totalPages: number
  pathname: string
  query: Record<string, string | undefined>
}) {
  if (totalPages <= 1) return null
  const href = (next: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value)
    params.set('page', String(next))
    return `${pathname}?${params}`
  }
  return <nav aria-label="Product pagination" className="flex justify-center items-center gap-6 mt-10 text-sm">
    {page > 1 && <Link href={href(page - 1)} className="underline">Previous</Link>}
    <span>Page {page} of {totalPages}</span>
    {page < totalPages && <Link href={href(page + 1)} className="underline">Next</Link>}
  </nav>
}
