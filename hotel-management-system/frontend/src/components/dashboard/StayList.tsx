import type { LucideIcon } from 'lucide-react'
import { Card, CardHeader } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { ReservationSummary } from '@/types/dashboard'
import { enumLabel } from '@/utils/format'
import { ModuleLink } from '@/components/common/ModuleLink'

interface StayListProps {
  title: string
  subtitle: string
  stays: ReservationSummary[]
  emptyTitle: string
  emptyIcon: LucideIcon
}

/** Compact list of today's arrivals or departures. */
export function StayList({ title, subtitle, stays, emptyTitle, emptyIcon }: StayListProps) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      {stays.length === 0 ? (
        <EmptyState title={emptyTitle} icon={emptyIcon} />
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {stays.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-canvas text-sm font-semibold text-ink tabular-nums">
                  {s.roomNumber}
                </span>
                <div className="min-w-0">
                  <ModuleLink to={`/reservations/${s.id}`} className="block truncate text-sm font-medium text-ink hover:text-brand-700 hover:underline">
                    {s.guestName}
                  </ModuleLink>
                  <p className="truncate text-xs text-ink-muted">
                    {enumLabel(s.roomType)} · {s.nights} {s.nights === 1 ? 'night' : 'nights'} · {s.numberOfGuests}{' '}
                    {s.numberOfGuests === 1 ? 'guest' : 'guests'}
                  </p>
                </div>
              </div>
              <StatusBadge kind="booking" status={s.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
