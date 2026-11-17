import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

interface PaginationProps {
  /** Zero-based current page. */
  page: number
  size: number
  totalElements: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

/** Page numbers to show: first, last, current ±1, with gaps marked as null. */
function pageWindow(current: number, total: number): Array<number | null> {
  const pages = new Set([0, total - 1, current - 1, current, current + 1].filter((p) => p >= 0 && p < total))
  const sorted = [...pages].sort((a, b) => a - b)
  const result: Array<number | null> = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) result.push(null)
    result.push(p)
  })
  return result
}

export function Pagination({ page, size, totalElements, totalPages, onPageChange, className }: PaginationProps) {
  if (totalElements === 0) return null
  const from = page * size + 1
  const to = Math.min(totalElements, (page + 1) * size)
  const buttonClass =
    'grid size-8 place-items-center rounded-md text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-40'

  return (
    <nav
      className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-3', className)}
      aria-label="Pagination"
    >
      <p className="text-xs text-ink-muted" aria-live="polite">
        Showing <span className="font-medium text-ink tabular-nums">{from}–{to}</span> of{' '}
        <span className="font-medium text-ink tabular-nums">{totalElements}</span>
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(buttonClass, 'text-ink-muted hover:bg-canvas')}
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-ink-subtle" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={cn(buttonClass, p === page ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-canvas')}
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p + 1}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p + 1}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(buttonClass, 'text-ink-muted hover:bg-canvas')}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </nav>
  )
}
