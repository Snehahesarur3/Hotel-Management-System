import { CheckCircle2, CircleDashed, Clock, Sparkles, type LucideIcon } from 'lucide-react'
import { Card, CardHeader } from '@/components/common/Card'
import { EmptyState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { HousekeepingOverview } from '@/types/dashboard'
import { enumLabel } from '@/utils/format'

function Count({ label, value, icon: Icon, className }: { label: string; value: number; icon: LucideIcon; className: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <Icon className={`size-3.5 ${className}`} aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  )
}

export function HousekeepingStatusCard({ housekeeping }: { housekeeping: HousekeepingOverview }) {
  const total = housekeeping.pending + housekeeping.inProgress + housekeeping.completed
  return (
    <Card>
      <CardHeader title="Housekeeping status" subtitle={`${total} tasks scheduled today`} />
      <div className="grid grid-cols-3 gap-2 px-5">
        <Count label="Pending" value={housekeeping.pending} icon={Clock} className="text-warning" />
        <Count label="In progress" value={housekeeping.inProgress} icon={CircleDashed} className="text-info" />
        <Count label="Completed" value={housekeeping.completed} icon={CheckCircle2} className="text-success" />
      </div>
      {housekeeping.openTasks.length === 0 ? (
        <EmptyState title="All of today’s tasks are done" icon={Sparkles} />
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {housekeeping.openTasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  Room {task.roomNumber} · {enumLabel(task.taskType)}
                </p>
                <p className="truncate text-xs text-ink-muted">{task.assignee}</p>
              </div>
              <StatusBadge kind="housekeeping" status={task.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
