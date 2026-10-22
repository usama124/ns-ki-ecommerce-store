export function CollectionHeading({ title, description, count }: { title: string; description?: string | null; count?: number }) {
  return <header className="mb-4 pb-3 border-b border-[#648698]/25">
    <div className="flex items-baseline justify-between gap-3">
      <h1 className="font-serif text-xl sm:text-2xl tracking-wide text-foreground">{title}</h1>
      {typeof count === 'number' && <span className="text-xs text-muted-foreground whitespace-nowrap">{count} {count === 1 ? 'product' : 'products'}</span>}
    </div>
    {description && <details className="mt-1 text-xs text-muted-foreground">
      <summary className="cursor-pointer py-1 w-fit">About this collection</summary>
      <p className="max-w-2xl mt-1 leading-relaxed">{description}</p>
    </details>}
  </header>
}
