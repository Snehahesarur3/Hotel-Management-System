import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorState, LoadingState } from './States'

interface QueryStateProps<T> {
  query: UseQueryResult<T, Error>
  loading?: ReactNode
  children: (data: T) => ReactNode
}

/** Renders loading / error (with retry) / data for a TanStack query, so every section handles all three. */
export function QueryState<T>({ query, loading, children }: QueryStateProps<T>) {
  if (query.isPending) return <>{loading ?? <LoadingState />}</>
  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
  }
  return <>{children(query.data)}</>
}
