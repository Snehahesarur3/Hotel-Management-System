import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Card } from '@/components/common/Card'
import { QueryState } from '@/components/common/QueryState'
import { Skeleton } from '@/components/common/States'
import { cn } from '@/utils/cn'

/** Row of KPI tiles at the top of each report. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">{children}</div>
}

function ReportSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading report">
      <StatGrid>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-[var(--radius-card)]" />
        ))}
      </StatGrid>
      <Skeleton className="h-80 rounded-[var(--radius-card)]" />
    </div>
  )
}

interface ReportQueryProps<T> {
  query: UseQueryResult<T, Error>
  children: (data: T) => ReactNode
}

/**
 * Loading skeleton, error with retry, or the report. While a new range loads,
 * the previous figures stay visible but dimmed (and marked busy for screen readers).
 */
export function ReportQuery<T>({ query, children }: ReportQueryProps<T>) {
  if (query.isError) {
    return (
      <Card>
        <QueryState query={query}>{() => null}</QueryState>
      </Card>
    )
  }
  return (
    <QueryState query={query} loading={<ReportSkeleton />}>
      {(data) => (
        <div aria-busy={query.isPlaceholderData} className={cn('space-y-6 transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          {children(data)}
        </div>
      )}
    </QueryState>
  )
}
