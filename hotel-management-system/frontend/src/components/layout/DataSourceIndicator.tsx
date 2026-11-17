import { apiMode } from '@/api'
import { useHealth } from '@/hooks/useHealth'
import { cn } from '@/utils/cn'

/** Shows which data source the app is using and whether it is reachable. */
export function DataSourceIndicator() {
  const { isPending, isError, refetch, isFetching } = useHealth()
  const label = apiMode === 'mock' ? 'Mock data' : 'Live API'
  const state = isPending ? 'Checking' : isError ? 'Unreachable' : 'Connected'

  return (
    <button
      type="button"
      onClick={() => void refetch()}
      disabled={isFetching}
      title={`${label}: ${state}. Click to re-check.`}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-muted hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      <span
        className={cn(
          'size-2 rounded-full',
          isPending || isFetching ? 'animate-pulse bg-ink-subtle' : isError ? 'bg-danger' : 'bg-success',
        )}
        aria-hidden
      />
      <span>{label}</span>
      <span className="sr-only">{state}</span>
    </button>
  )
}
