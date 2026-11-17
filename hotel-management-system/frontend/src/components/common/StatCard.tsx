import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface StatCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  hint?: ReactNode
  /** Optional 0-100 meter rendered under the value. */
  meter?: number
  className?: string
}

/** KPI tile: label, headline value, optional hint line and meter. */
export function StatCard({ label, value, icon: Icon, hint, meter, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-ink-muted">{label}</p>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="truncate text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {meter !== undefined && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-brand-100"
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meter}
        >
          <div className="h-full rounded-full bg-series-1" style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
        </div>
      )}
      {hint && <p className="truncate text-xs text-ink-subtle">{hint}</p>}
    </div>
  )
}
