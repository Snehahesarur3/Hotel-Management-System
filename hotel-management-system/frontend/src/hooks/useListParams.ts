import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SortSpec } from '@/types/api'

export interface ListParams<F extends string> {
  page: number
  search: string
  sort?: SortSpec<F>
  /** Raw filter values from the URL (empty string = not set). */
  filters: Record<string, string>
}

/**
 * List state (page, search, sort, filters) kept in the URL query string, so filtered views
 * survive refreshes, can be bookmarked, and work with the back button.
 * Changing anything other than the page resets to the first page.
 */
export function useListParams<F extends string>(filterKeys: readonly string[], sortFields: readonly F[]) {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = useMemo<ListParams<F>>(() => {
    const page = Math.max(0, Number.parseInt(searchParams.get('page') ?? '1', 10) - 1) || 0
    const [field, direction] = (searchParams.get('sort') ?? '').split(',')
    const sort =
      field && (sortFields as readonly string[]).includes(field)
        ? { field: field as F, direction: direction === 'desc' ? ('desc' as const) : ('asc' as const) }
        : undefined
    const filters = Object.fromEntries(filterKeys.map((key) => [key, searchParams.get(key) ?? '']))
    return { page, search: searchParams.get('q') ?? '', sort, filters }
  }, [searchParams, filterKeys, sortFields])

  const update = useCallback(
    (changes: { page?: number; search?: string; sort?: SortSpec<F> | null; filters?: Record<string, string> }) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          const set = (key: string, value: string | undefined) => (value ? next.set(key, value) : next.delete(key))
          if (changes.search !== undefined) set('q', changes.search.trim())
          if (changes.sort !== undefined) set('sort', changes.sort ? `${changes.sort.field},${changes.sort.direction}` : undefined)
          for (const [key, value] of Object.entries(changes.filters ?? {})) set(key, value)
          // Page is 1-based in the URL for readability.
          set('page', changes.page !== undefined && changes.page > 0 ? String(changes.page + 1) : undefined)
          return next
        },
        { replace: changes.page === undefined },
      )
    },
    [setSearchParams],
  )

  const clear = useCallback(() => setSearchParams(new URLSearchParams(), { replace: true }), [setSearchParams])

  return { params, update, clear }
}
