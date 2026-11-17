import type { ListQuery } from '@/types/api'

type Primitive = string | number | boolean
type QueryValue = Primitive | null | undefined | readonly Primitive[]

/**
 * Converts a list query (+ module filters) into URL query parameters for the Spring Boot API:
 *   { page: 0, size: 20, search: 'suite', sort: { field: 'floor', direction: 'desc' }, floor: 2 }
 *   -> page=0&size=20&search=suite&sort=floor,desc&floor=2
 * Empty values are omitted; arrays repeat the key (status=A&status=B), as Spring binds them to lists.
 */
export function toQueryParams<Q extends object>(query?: Q): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, raw] of Object.entries((query ?? {}) as Record<string, unknown>)) {
    if (key === 'sort') {
      const sort = raw as ListQuery['sort']
      if (sort) params.append('sort', `${sort.field},${sort.direction}`)
      continue
    }
    const value = raw as QueryValue
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)))
    else params.append(key, String(value).trim())
  }
  return params
}
