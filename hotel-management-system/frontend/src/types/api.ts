/** Shapes shared by the mock services and the Spring Boot API (see backend com.hotel.dto). */

export interface PageResponse<T> {
  content: T[]
  /** Zero-based page index. */
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface PageRequest {
  page?: number
  size?: number
}

export type SortDirection = 'asc' | 'desc'

export interface SortSpec<F extends string = string> {
  field: F
  direction: SortDirection
}

/**
 * Common list query accepted by every list endpoint.
 * Module services extend it with typed filters, e.g. `ListQuery & { floor?: number }`.
 * Over HTTP it becomes query parameters: ?page=0&size=20&search=...&sort=field,asc&floor=2
 */
export interface ListQuery<F extends string = string> extends PageRequest {
  /** Free-text, case-insensitive search across the module's searchable fields. */
  search?: string
  sort?: SortSpec<F>
}

/** Normalized error thrown by both adapters, so UI error handling is source-agnostic. */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors?: Record<string, string>

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export interface HealthStatus {
  status: 'UP' | 'DOWN'
  dataMode: string
  timestamp: string
}
