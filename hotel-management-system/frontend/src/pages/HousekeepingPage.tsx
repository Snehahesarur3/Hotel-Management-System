import { BedDouble, CheckCircle2, CircleDashed, Clock, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/common/Badge'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card, CardHeader } from '@/components/common/Card'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TextInput } from '@/components/common/FormControls'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, LoadingState, Skeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TaskFormModal } from '@/components/housekeeping/TaskFormModal'
import { useDeleteTask, useHousekeepingSummary, useHousekeepingTasks, useUpdateTaskStatus } from '@/hooks/useHousekeeping'
import { useListParams } from '@/hooks/useListParams'
import { useRoomFloors } from '@/hooks/useRooms'
import { HOUSEKEEPING_STATUSES, HOUSEKEEPING_TASK_TYPES, type HousekeepingStatus, type HousekeepingTaskType, type TaskPriority } from '@/types/enums'
import type { HousekeepingListQuery, HousekeepingSortField, HousekeepingTaskView } from '@/types/housekeeping'
import { todayISO } from '@/utils/date'
import { enumLabel, formatDate, formatDateTime, formatLongDate } from '@/utils/format'

const FILTER_KEYS = ['date', 'status', 'floor', 'staff', 'type'] as const
const SORT_FIELDS: readonly HousekeepingSortField[] = ['scheduledDate', 'roomNumber', 'priority', 'status', 'taskType', 'assignee']
const PAGE_SIZE = 20
const ISO = /^\d{4}-\d{2}-\d{2}$/
const PRIORITY_TONE: Record<TaskPriority, 'danger' | 'neutral' | 'info'> = { HIGH: 'danger', NORMAL: 'neutral', LOW: 'info' }

const oneOf = <T extends string>(values: readonly T[], value: string | undefined) =>
  value && (values as readonly string[]).includes(value) ? (value as T) : undefined

const iconButton =
  'grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600'

export function HousekeepingPage() {
  const canManage = useCan()('housekeeping.manage')
  const today = todayISO()
  const { params, update, clear } = useListParams(FILTER_KEYS, SORT_FIELDS)
  // No date in the URL = today; "all" = every date.
  const rawDate = params.filters.date ?? ''
  const date = rawDate === 'all' ? undefined : ISO.test(rawDate) ? rawDate : today
  const floor = Number.parseInt(params.filters.floor ?? '', 10)
  const query: HousekeepingListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    date,
    status: oneOf<HousekeepingStatus>(HOUSEKEEPING_STATUSES, params.filters.status),
    floor: Number.isInteger(floor) ? floor : undefined,
    staffId: params.filters.staff || undefined,
    taskType: oneOf<HousekeepingTaskType>(HOUSEKEEPING_TASK_TYPES, params.filters.type),
  }
  const tasks = useHousekeepingTasks(query)
  const summaryDate = date ?? today
  const summary = useHousekeepingSummary(summaryDate)
  const floors = useRoomFloors()
  const setStatus = useUpdateTaskStatus()
  const [formTask, setFormTask] = useState<HousekeepingTaskView | 'new' | null>(null)
  const [deleting, setDeleting] = useState<HousekeepingTaskView | null>(null)
  const deleteTask = useDeleteTask({ onDone: () => setDeleting(null) })
  const filtersActive = Boolean(params.search || rawDate || query.status || query.floor !== undefined || query.staffId || query.taskType)

  const lastPage = tasks.data && tasks.data.totalPages > 0 ? tasks.data.totalPages - 1 : 0
  const pageOutOfRange = Boolean(tasks.data && !tasks.isPlaceholderData && params.page > lastPage)
  useEffect(() => {
    if (pageOutOfRange) update({ page: lastPage })
  }, [pageOutOfRange, lastPage, update])

  const busyId = setStatus.isPending ? setStatus.variables?.id : undefined
  const columns: Column<HousekeepingTaskView>[] = [
    {
      key: 'room',
      header: 'Room',
      sortField: 'roomNumber',
      render: (t) => (
        <div>
          <Link to={`/rooms/${t.roomId}`} className="font-medium text-brand-700 hover:underline">
            {t.roomNumber}
          </Link>
          <p className="text-xs text-ink-muted">Floor {t.floor}</p>
        </div>
      ),
    },
    {
      key: 'task',
      header: 'Task',
      sortField: 'taskType',
      render: (t) => (
        <div className="max-w-xs whitespace-normal">
          <span>{enumLabel(t.taskType)}</span>
          {t.notes && <p className="text-xs text-ink-muted">{t.notes}</p>}
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', sortField: 'priority', render: (t) => <Badge tone={PRIORITY_TONE[t.priority]}>{enumLabel(t.priority)}</Badge> },
    { key: 'roomStatus', header: 'Room status', hideOnMobile: true, render: (t) => <StatusBadge kind="room" status={t.roomStatus} /> },
    { key: 'date', header: 'Date', sortField: 'scheduledDate', hideOnMobile: true, render: (t) => (t.scheduledDate === today ? 'Today' : formatDate(t.scheduledDate)) },
    { key: 'assignee', header: 'Assigned to', sortField: 'assignee', hideOnMobile: true, render: (t) => t.assignee },
    {
      key: 'status',
      header: 'Status',
      sortField: 'status',
      render: (t) => (
        <div>
          <StatusBadge kind="housekeeping" status={t.status} />
          {t.completedAt && <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(t.completedAt)}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hidden: !canManage,
      render: (t) => (
        <div className="flex items-center justify-end gap-1">
          {t.status === 'PENDING' && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Play className="size-3.5" aria-hidden />}
              loading={busyId === t.id}
              onClick={() => setStatus.mutate({ id: t.id, status: 'IN_PROGRESS' })}
              aria-label={`Start ${t.id}`}
            >
              Start
            </Button>
          )}
          {t.status === 'IN_PROGRESS' && (
            <>
              <button type="button" className={iconButton} onClick={() => setStatus.mutate({ id: t.id, status: 'PENDING' })} aria-label={`Pause ${t.id}`}>
                <Pause className="size-4" aria-hidden />
              </button>
              <Button
                size="sm"
                icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                loading={busyId === t.id}
                onClick={() => setStatus.mutate({ id: t.id, status: 'COMPLETED' })}
                aria-label={`Complete ${t.id}`}
              >
                Complete
              </Button>
            </>
          )}
          {t.status !== 'COMPLETED' && (
            <button type="button" className={iconButton} onClick={() => setFormTask(t)} aria-label={`Edit ${t.id}`}>
              <Pencil className="size-4" aria-hidden />
            </button>
          )}
          {t.status === 'PENDING' && (
            <button type="button" className={`${iconButton} hover:text-danger`} onClick={() => setDeleting(t)} aria-label={`Delete ${t.id}`}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ]

  const s = summary.data
  return (
    <div className="space-y-6">
      <PageHeader
        title="Housekeeping"
        description={date ? `Cleaning schedule for ${formatLongDate(date)}.` : 'Cleaning schedule, all dates.'}
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setFormTask('new')}>
              New task
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <StatCard label="Pending" value={s.pending} icon={Clock} hint={summaryDate === today ? 'Scheduled today' : formatDate(summaryDate)} />
            <StatCard label="In progress" value={s.inProgress} icon={CircleDashed} hint="Being worked on" />
            <StatCard label="Completed" value={s.completed} icon={CheckCircle2} hint={summaryDate === today ? 'Done today' : formatDate(summaryDate)} />
            <StatCard label="Rooms to clean" value={s.roomsToClean} icon={BedDouble} hint="In Cleaning; can't be let yet" />
          </>
        ) : summary.isError ? null : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-[var(--radius-card)]" />)
        )}
      </div>

      {s && (
        <Card>
          <CardHeader title="Staff workload" subtitle={`Open and completed tasks${summaryDate === today ? ' today' : ` on ${formatDate(summaryDate)}`}`} />
          <ul className="flex flex-wrap gap-2 px-5 pb-4">
            {s.staff.map((m) => (
              <li key={m.staffId}>
                <button
                  type="button"
                  onClick={() => update({ filters: { staff: query.staffId === m.staffId ? '' : m.staffId } })}
                  aria-pressed={query.staffId === m.staffId}
                  className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-600 aria-pressed:border-brand-500 aria-pressed:bg-brand-50"
                >
                  <span className="font-medium text-ink">{m.fullName}</span>
                  <span className="text-xs text-ink-muted">
                    {m.open} open · {m.completed} done
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput label="Search tasks" placeholder="Room, staff, notes…" value={params.search} onSearch={(search) => update({ search })} className="lg:w-56" />
          <div className="flex items-center gap-2">
            <TextInput
              type="date"
              aria-label="Scheduled date"
              value={date ?? ''}
              onChange={(e) => update({ filters: { date: e.target.value === today ? '' : e.target.value || 'all' } })}
              className="min-w-0 flex-1 lg:w-40 lg:flex-none"
            />
            {date ? (
              <Button variant="ghost" size="sm" onClick={() => update({ filters: { date: 'all' } })}>
                All dates
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => update({ filters: { date: '' } })}>
                Today
              </Button>
            )}
          </div>
          <FilterSelect
            label="Filter by status"
            allLabel="All statuses"
            value={query.status ?? ''}
            options={HOUSEKEEPING_STATUSES.map((v) => ({ value: v, label: enumLabel(v) }))}
            onChange={(value) => update({ filters: { status: value } })}
            className="lg:w-36"
          />
          <FilterSelect
            label="Filter by floor"
            allLabel="All floors"
            value={query.floor !== undefined ? String(query.floor) : ''}
            options={(floors.data ?? []).map((f) => ({ value: String(f), label: `Floor ${f}` }))}
            onChange={(value) => update({ filters: { floor: value } })}
            className="lg:w-32"
          />
          <FilterSelect
            label="Filter by task type"
            allLabel="All tasks"
            value={query.taskType ?? ''}
            options={HOUSEKEEPING_TASK_TYPES.map((v) => ({ value: v, label: enumLabel(v) }))}
            onChange={(value) => update({ filters: { type: value } })}
            className="lg:w-40"
          />
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clear} className="lg:ml-auto">
              Reset filters
            </Button>
          )}
        </div>

        {tasks.isPending ? (
          <div className="px-5 pb-5">
            <LoadingState label="Loading tasks" rows={8} />
          </div>
        ) : tasks.isError ? (
          <ErrorState message={tasks.error.message} onRetry={() => void tasks.refetch()} retrying={tasks.isFetching} />
        ) : (
          <>
            <DataTable
              caption="Housekeeping tasks"
              columns={columns}
              rows={tasks.data.content}
              rowKey={(t) => t.id}
              sort={params.sort}
              onSortChange={(sort) => update({ sort: sort as HousekeepingListQuery['sort'] | null })}
              busy={tasks.isPlaceholderData}
              emptyTitle={filtersActive ? 'No tasks match your filters' : 'No tasks scheduled today'}
              emptyDescription={filtersActive ? 'Try another date, floor or status.' : 'Create a task, or check out a guest to schedule a checkout clean.'}
              emptyAction={
                canManage && (
                  <Button size="sm" onClick={() => setFormTask('new')}>
                    New task
                  </Button>
                )
              }
            />
            <Pagination
              className="border-t border-line"
              page={tasks.data.page}
              size={tasks.data.size}
              totalElements={tasks.data.totalElements}
              totalPages={tasks.data.totalPages}
              onPageChange={(page) => update({ page })}
            />
          </>
        )}
      </Card>

      <TaskFormModal open={formTask !== null} task={formTask === 'new' ? undefined : (formTask ?? undefined)} onClose={() => setFormTask(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.id}?` : 'Delete task?'}
        message={deleting && <p>{enumLabel(deleting.taskType)} for Room {deleting.roomNumber}. Only tasks that haven’t started can be deleted.</p>}
        confirmLabel="Delete task"
        tone="danger"
        loading={deleteTask.isPending}
        onConfirm={() => deleting && deleteTask.mutate(deleting, { onError: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
