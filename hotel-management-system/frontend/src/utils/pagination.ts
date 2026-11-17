import type { PageResponse } from '@/types/api'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 200

/** Client-side pagination with the same semantics as the backend PageUtils (zero-based pages). */
export function paginate<T>(items: readonly T[], page = 0, size = DEFAULT_PAGE_SIZE): PageResponse<T> {
  if (!Number.isInteger(page) || page < 0) throw new RangeError('page must be >= 0')
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw new RangeError(`size must be between 1 and ${MAX_PAGE_SIZE}`)
  }
  const totalElements = items.length
  const from = Math.min(page * size, totalElements)
  return {
    content: items.slice(from, from + size),
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
  }
}
