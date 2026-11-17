import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SortSpec } from '@/types/api'
import { cn } from '@/utils/cn'
import { EmptyState } from './States'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** Hide below the md breakpoint to keep narrow screens readable. */
  hideOnMobile?: boolean
  /** Field name sent to the API when this column is sorted; omit for unsortable columns. */
  sortField?: string
  className?: string
  /** Leave the column out, e.g. row actions the signed-in user cannot use. */
  hidden?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  caption: string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  onRowClick?: (row: T) => void
  /** Current sort (controlled). */
  sort?: SortSpec
  /** Called when a sortable header is clicked: asc -> desc -> unsorted. */
  onSortChange?: (sort: SortSpec | null) => void
  /** Dims the rows while a refetch is in flight. */
  busy?: boolean
  className?: string
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const
const JUSTIFY = { left: 'justify-start', right: 'justify-end', center: 'justify-center' } as const

function nextSort(current: SortSpec | undefined, field: string): SortSpec | null {
  if (current?.field !== field) return { field, direction: 'asc' }
  return current.direction === 'asc' ? { field, direction: 'desc' } : null
}

/** Accessible, horizontally scrollable table with optional sortable headers and an empty state. */
export function DataTable<T>({
  columns: allColumns,
  rows,
  rowKey,
  caption,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  onRowClick,
  sort,
  onSortChange,
  busy,
  className,
}: DataTableProps<T>) {
  const columns = allColumns.filter((col) => !col.hidden)
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />

  return (
    // relative: keeps absolutely positioned sr-only labels inside the scroll area (they would otherwise widen the page on phones).
    <div className={cn('relative overflow-x-auto', className)}>
      <table className={cn('w-full min-w-full border-collapse text-sm transition-opacity', busy && 'opacity-60')} aria-busy={busy || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-y border-line bg-canvas/60">
            {columns.map((col) => {
              const align = col.align ?? 'left'
              const sortable = Boolean(col.sortField && onSortChange)
              const active = sortable && sort?.field === col.sortField
              const SortIcon = !active ? ChevronsUpDown : sort?.direction === 'asc' ? ArrowUp : ArrowDown
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'px-4 py-2.5 text-xs font-medium whitespace-nowrap text-ink-muted first:pl-5 last:pr-5',
                    ALIGN[align],
                    col.hideOnMobile && 'hidden md:table-cell',
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange?.(nextSort(sort, col.sortField!))}
                      className={cn(
                        'inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600',
                        JUSTIFY[align],
                        active && 'text-ink',
                      )}
                    >
                      {col.header}
                      <SortIcon className={cn('size-3.5', !active && 'opacity-50')} aria-hidden />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('transition-colors hover:bg-canvas/70', onRowClick && 'cursor-pointer')}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 whitespace-nowrap text-ink tabular-nums first:pl-5 last:pr-5',
                    ALIGN[col.align ?? 'left'],
                    col.hideOnMobile && 'hidden md:table-cell',
                    col.className,
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
