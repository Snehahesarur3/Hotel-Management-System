import { Pencil, Trash2, UserCheck, UserMinus, UserPlus, Users, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, LoadingState, Skeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { StaffFormModal } from '@/components/staff/StaffFormModal'
import { useListParams } from '@/hooks/useListParams'
import { useDeleteStaff, useStaffList, useStaffSummary } from '@/hooks/useStaff'
import { DEPARTMENTS, EMPLOYMENT_STATUSES, type Department, type EmploymentStatus } from '@/types/enums'
import type { StaffListQuery, StaffSortField, StaffView } from '@/types/staff'
import { enumLabel, formatDate } from '@/utils/format'

const FILTER_KEYS = ['department', 'status'] as const
const SORT_FIELDS: readonly StaffSortField[] = ['fullName', 'department', 'designation', 'joiningDate', 'employmentStatus']
const PAGE_SIZE = 15
const oneOf = <T extends string>(values: readonly T[], value: string | undefined) =>
  value && (values as readonly string[]).includes(value) ? (value as T) : undefined

const iconButton =
  'grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600'

export function StaffPage() {
  const { params, update, clear } = useListParams(FILTER_KEYS, SORT_FIELDS)
  const canManage = useCan()('staff.manage')
  const query: StaffListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    department: oneOf<Department>(DEPARTMENTS, params.filters.department),
    status: oneOf<EmploymentStatus>(EMPLOYMENT_STATUSES, params.filters.status),
  }
  const staff = useStaffList(query)
  const summary = useStaffSummary()
  const [formMember, setFormMember] = useState<StaffView | 'new' | null>(null)
  const [deleting, setDeleting] = useState<StaffView | null>(null)
  const remove = useDeleteStaff({ onDone: () => setDeleting(null) })
  const filtersActive = Boolean(query.search || query.department || query.status)

  const lastPage = staff.data && staff.data.totalPages > 0 ? staff.data.totalPages - 1 : 0
  const pageOutOfRange = Boolean(staff.data && !staff.isPlaceholderData && params.page > lastPage)
  useEffect(() => {
    if (pageOutOfRange) update({ page: lastPage })
  }, [pageOutOfRange, lastPage, update])

  const columns: Column<StaffView>[] = [
    {
      key: 'name',
      header: 'Name',
      sortField: 'fullName',
      render: (s) => (
        <div>
          <span className="font-medium">{s.fullName}</span>
          <p className="text-xs text-ink-muted">{s.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Department',
      sortField: 'department',
      render: (s) => (
        <div>
          <span>{enumLabel(s.department)}</span>
          <p className="text-xs text-ink-muted">{s.designation}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideOnMobile: true, render: (s) => s.phone },
    { key: 'joined', header: 'Joined', sortField: 'joiningDate', hideOnMobile: true, render: (s) => formatDate(s.joiningDate) },
    {
      key: 'tasks',
      header: 'Open tasks',
      align: 'right',
      hideOnMobile: true,
      render: (s) =>
        s.openTasks > 0 ? (
          <Link to={`/housekeeping?date=all&staff=${s.id}`} className="font-medium text-brand-700 hover:underline">
            {s.openTasks}
          </Link>
        ) : (
          <span className="text-ink-subtle">0</span>
        ),
    },
    { key: 'status', header: 'Status', sortField: 'employmentStatus', render: (s) => <StatusBadge kind="employment" status={s.employmentStatus} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hidden: !canManage,
      render: (s) => (
        <div className="flex justify-end gap-1">
          <button type="button" className={iconButton} onClick={() => setFormMember(s)} aria-label={`Edit ${s.fullName}`}>
            <Pencil className="size-4" aria-hidden />
          </button>
          <button type="button" className={`${iconButton} hover:text-danger`} onClick={() => setDeleting(s)} aria-label={`Delete ${s.fullName}`}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ]

  const s = summary.data
  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Employees, departments and employment status."
        actions={
          canManage && (
            <Button icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setFormMember('new')}>
              Add staff member
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <StatCard label="Total staff" value={s.total} icon={Users} hint={`${s.byDepartment.filter((d) => d.total > 0).length} departments`} />
            <StatCard label="Active" value={s.active} icon={UserCheck} hint="Available for work" />
            <StatCard label="On leave" value={s.onLeave} icon={UserMinus} hint="Temporarily away" />
            <StatCard label="Inactive" value={s.inactive} icon={UserX} hint="Former or suspended" />
          </>
        ) : summary.isError ? null : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-[var(--radius-card)]" />)
        )}
      </div>

      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput label="Search staff" placeholder="Name, email, phone, job title…" value={params.search} onSearch={(search) => update({ search })} className="sm:w-72" />
          <FilterSelect
            label="Filter by department"
            allLabel="All departments"
            value={query.department ?? ''}
            options={DEPARTMENTS.map((d) => ({ value: d, label: enumLabel(d) }))}
            onChange={(value) => update({ filters: { department: value } })}
          />
          <FilterSelect
            label="Filter by employment status"
            allLabel="All statuses"
            value={query.status ?? ''}
            options={EMPLOYMENT_STATUSES.map((v) => ({ value: v, label: enumLabel(v) }))}
            onChange={(value) => update({ filters: { status: value } })}
          />
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clear} className="sm:ml-auto">
              Clear filters
            </Button>
          )}
        </div>
        {staff.isPending ? (
          <div className="px-5 pb-5">
            <LoadingState label="Loading staff" rows={8} />
          </div>
        ) : staff.isError ? (
          <ErrorState message={staff.error.message} onRetry={() => void staff.refetch()} retrying={staff.isFetching} />
        ) : (
          <>
            <DataTable
              caption="Staff"
              columns={columns}
              rows={staff.data.content}
              rowKey={(m) => m.id}
              sort={params.sort}
              onSortChange={(sort) => update({ sort: sort as StaffListQuery['sort'] | null })}
              busy={staff.isPlaceholderData}
              emptyTitle={filtersActive ? 'No staff match your filters' : 'No staff yet'}
              emptyAction={
                filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
            <Pagination
              className="border-t border-line"
              page={staff.data.page}
              size={staff.data.size}
              totalElements={staff.data.totalElements}
              totalPages={staff.data.totalPages}
              onPageChange={(page) => update({ page })}
            />
          </>
        )}
      </Card>

      <StaffFormModal open={formMember !== null} member={formMember === 'new' ? undefined : (formMember ?? undefined)} onClose={() => setFormMember(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Remove ${deleting.fullName}?` : 'Remove staff member?'}
        message={
          <>
            <p>This permanently deletes the employee record.</p>
            <p className="mt-2 text-xs text-ink-subtle">Staff with housekeeping task history are kept for the record. Set them to Inactive instead.</p>
          </>
        }
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting, { onError: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
