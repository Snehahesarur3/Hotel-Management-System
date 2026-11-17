import { getDatabase, mutateDatabase } from '@/mock/db'
import type { MockDatabase } from '@/mock/seed'
import { ApiError, type ListQuery, type PageResponse } from '@/types/api'
import { DEFAULT_PAGE_SIZE, paginate } from '@/utils/pagination'

/**
 * Generic building blocks for the module mock services (rooms, guests, ...).
 * They are synchronous and run inside `mockCall`, which adds latency and cloning.
 * Business rules (overlap checks, status transitions...) live in the module services.
 */

export type CollectionKey = Exclude<keyof MockDatabase, 'seededOn' | 'settings'>
export type EntityOf<K extends CollectionKey> = MockDatabase[K][number]

// ------------------------------------------------------------------ querying

/** Lower-cases and strips accents so "jose" matches "José". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function matchesSearch(fields: ReadonlyArray<string | number | undefined | null>, search?: string): boolean {
  if (!search?.trim()) return true
  const terms = normalizeText(search).split(/\s+/)
  const haystack = normalizeText(fields.filter((f) => f !== undefined && f !== null).join(' '))
  return terms.every((term) => haystack.includes(term))
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === undefined || a === null) return 1 // empty values sort last
  if (b === undefined || b === null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return collator.compare(String(a), String(b))
}

export interface QueryOptions<T> {
  /** Values searched by `query.search`. */
  searchFields?: (item: T) => ReadonlyArray<string | number | undefined | null>
  /** Module-specific filters (already combined into one predicate). */
  filter?: (item: T) => boolean
  /** Custom sort accessors for computed or nested fields; plain fields are read directly. */
  sortAccessors?: Record<string, (item: T) => unknown>
  /** Order applied when the query has no sort (and as a tie-breaker). */
  defaultSort?: (a: T, b: T) => number
}

/** Search -> filter -> sort -> paginate, with the same semantics as the backend list endpoints. */
export function applyListQuery<T>(items: readonly T[], query: ListQuery = {}, options: QueryOptions<T> = {}): PageResponse<T> {
  const { searchFields, filter, sortAccessors = {}, defaultSort } = options
  let result = items.filter(
    (item) => (!filter || filter(item)) && (!searchFields || matchesSearch(searchFields(item), query.search)),
  )

  const { sort } = query
  if (sort) {
    const accessor = sortAccessors[sort.field] ?? ((item: T) => (item as Record<string, unknown>)[sort.field])
    const direction = sort.direction === 'desc' ? -1 : 1
    result = [...result].sort((a, b) => {
      const primary = compareValues(accessor(a), accessor(b))
      // Empty values stay last regardless of direction.
      const aEmpty = accessor(a) === undefined || accessor(a) === null
      const bEmpty = accessor(b) === undefined || accessor(b) === null
      const ordered = aEmpty || bEmpty ? primary : primary * direction
      return ordered || (defaultSort ? defaultSort(a, b) : 0)
    })
  } else if (defaultSort) {
    result = [...result].sort(defaultSort)
  }

  return paginate(result, query.page ?? 0, query.size ?? DEFAULT_PAGE_SIZE)
}

// ------------------------------------------------------------------ ids

/**
 * Next id for a prefix, e.g. nextId(['BK-0040', 'BK-0007'], 'BK') -> 'BK-0041'.
 * Mirrors the backend InMemoryRepository so ids look identical in both modes.
 */
export function nextId(existingIds: Iterable<string>, prefix: string): string {
  let max = 0
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  for (const id of existingIds) {
    const match = pattern.exec(id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

// ------------------------------------------------------------------ CRUD

export interface CollectionOptions {
  /** Human-readable name used in error messages, e.g. "Room". */
  resource: string
  /** Id prefix for new records, e.g. "RM". */
  idPrefix: string
}

/** Typed CRUD primitives over one collection of the mock database. */
export function collection<K extends CollectionKey>(key: K, { resource, idPrefix }: CollectionOptions) {
  type Entity = EntityOf<K>
  const list = (db: MockDatabase) => db[key] as Entity[]
  const notFound = (id: string) => new ApiError(404, `${resource} with id '${id}' was not found`)

  return {
    all(): Entity[] {
      return list(getDatabase())
    },

    findById(id: string): Entity | undefined {
      return list(getDatabase()).find((e) => e.id === id)
    },

    /** Like findById, but throws a 404 ApiError when missing. */
    get(id: string): Entity {
      const entity = this.findById(id)
      if (!entity) throw notFound(id)
      return entity
    },

    /** Inserts a new record; assigns the next id unless one is provided (409 if it already exists). */
    insert(data: Omit<Entity, 'id'> & { id?: string }): Entity {
      return mutateDatabase((db) => {
        const items = list(db)
        const id = data.id ?? nextId(items.map((e) => e.id), idPrefix)
        if (items.some((e) => e.id === id)) {
          throw new ApiError(409, `${resource} with id '${id}' already exists`)
        }
        const entity = { ...data, id } as Entity
        items.push(entity)
        return entity
      })
    },

    /** Replaces fields of an existing record (the id cannot change). */
    update(id: string, changes: Partial<Omit<Entity, 'id'>>): Entity {
      return mutateDatabase((db) => {
        const items = list(db)
        const index = items.findIndex((e) => e.id === id)
        if (index === -1) throw notFound(id)
        const updated = { ...items[index]!, ...changes, id } as Entity
        items[index] = updated
        return updated
      })
    },

    remove(id: string): void {
      mutateDatabase((db) => {
        const items = list(db)
        const index = items.findIndex((e) => e.id === id)
        if (index === -1) throw notFound(id)
        items.splice(index, 1)
      })
    },
  }
}
