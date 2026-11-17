import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Button } from './Button'

/** Pulsing placeholder block for loading layouts. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-neutral-soft', className)} aria-hidden />
}

export function LoadingState({ label = 'Loading…', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 py-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i % 3 === 2 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)}>
      <span className="grid size-10 place-items-center rounded-full bg-neutral-soft text-ink-subtle">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-xs text-xs text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

export function ErrorState({ message = 'Something went wrong.', onRetry, retrying, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 px-4 py-8 text-center', className)}>
      <span className="grid size-10 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-ink">Couldn’t load this section</p>
      <p className="max-w-xs text-xs text-ink-muted">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={onRetry}
          loading={retrying}
          icon={<RefreshCw className="size-3.5" aria-hidden />}
        >
          Try again
        </Button>
      )}
    </div>
  )
}
