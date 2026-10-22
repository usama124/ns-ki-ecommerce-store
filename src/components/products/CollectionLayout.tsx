'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

export function CollectionLayout({ search, filters, children }: { search: ReactNode; filters: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)] gap-4 md:gap-6 items-start">
    <div className="flex gap-3 items-center md:col-span-2">
      <div className="min-w-0 flex-1">{search}</div>
      <button type="button" aria-controls={id} aria-expanded={open} onClick={() => setOpen(value => !value)}
        className="md:hidden shrink-0 min-h-11 px-3 flex items-center gap-2 rounded-lg border border-[#648698]/40 text-xs font-medium text-foreground">
        {open ? <X className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />} <span className="sr-only sm:not-sr-only">Filters & sort</span>
      </button>
    </div>
    <aside id={id} aria-label="Collection filters" onClick={event => { if ((event.target as HTMLElement).closest('a[href], [data-collection-choice]')) setOpen(false) }} className={`${open ? 'block' : 'hidden'} md:block md:sticky md:top-36 md:max-h-[calc(100svh-10rem)] md:overflow-y-auto`}>
      <div className="space-y-5 p-3 md:p-0 rounded-xl border border-[#648698]/20 md:border-0">{filters}</div>
      {open && <button type="button" className="md:hidden mt-3 min-h-11 w-full glass-button-primary rounded-lg text-xs" onClick={() => setOpen(false)}>Show products</button>}
    </aside>
    <div className="min-w-0">{children}</div>
  </div>
}
