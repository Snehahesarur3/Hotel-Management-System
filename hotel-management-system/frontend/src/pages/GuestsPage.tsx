import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { ErrorState, LoadingState } from '@/components/common/States'
import { DeleteGuestDialog } from '@/components/guests/DeleteGuestDialog'
import { GuestFormModal } from '@/components/guests/GuestFormModal'
import { useGuestList, useGuestNationalities } from '@/hooks/useGuests'
import { useListParams } from '@/hooks/useListParams'
import type { GuestListQuery, GuestSortField, GuestSummary } from '@/types/guest'
import { enumLabel, formatDate } from '@/utils/format'

const FILTER_KEYS = ['nationality'] as const
const SORT_FIELDS: readonly GuestSortField[] = ['fullName', 'nationality', 'registrationDate', 'previousBookingCount', 'lastStay']
const PAGE_SIZE = 15

const iconButton =
  'grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600'

export function GuestsPage() {
  const { params, update, clear } = useListParams(FILTER_KEYS, SORT_FIELDS)
  const can = useCan()
  const canManage = can('guests.manage')
  const canDelete = can('guests.delete')
  const query: GuestListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    nationality: params.filters.nationality || undefined,
  }
  const guests = useGuestList(query)
  const nationalities = useGuestNationalities()
  const [formGuest, setFormGuest] = useState<GuestSummary | 'new' | null>(null)
  const [deleting, setDeleting] = useState<GuestSummary | null>(null)
  const filtersActive = Boolean(params.search || query.nationality)

  const lastPage = guests.data && guests.data.totalPages > 0 ? guests.data.totalPages - 1 : 0
  const pageOutOfRange = Boolean(guests.data && !guests.isPlaceholderData && params.page > lastPage)
  useEffect(() => {
    if (pageOutOfRange) update({ page: lastPage })
  }, [pageOutOfRange, lastPage, update])

  const columns: Column<GuestSummary>[] = [
    {
      key: 'name',
      header: 'Guest',
      sortField: 'fullName',
      render: (g) => (
        <div className="min-w-0">
          <Link to={`/guests/${g.id}`} className="font-medium text-brand-700 hover:underline">
            {g.fullName}
          </Link>
          <p className="text-xs text-ink-muted">{g.email}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideOnMobile: true, render: (g) => g.phone },
    { key: 'nationality', header: 'Nationality', sortField: 'nationality', hideOnMobile: true, render: (g) => g.nationality },
    {
      key: 'id',
      header: 'ID proof',
      hideOnMobile: true,
      render: (g) => (
        <span className="text-ink-muted">
          {enumLabel(g.idProofType)} <span className="text-ink-subtle">· {g.idProofNumber.slice(-4)}</span>
        </span>
      ),
    },
    { key: 'stays', header: 'Stays', sortField: 'previousBookingCount', align: 'right', render: (g) => g.previousBookingCount },
    {
      key: 'last',
      header: 'Last stay',
      sortField: 'lastStay',
      hideOnMobile: true,
      render: (g) => (g.lastStay ? formatDate(g.lastStay) : <span className="text-ink-subtle">—</span>),
    },
    { key: 'registered', header: 'Registered', sortField: 'registrationDate', hideOnMobile: true, render: (g) => formatDate(g.registrationDate) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hidden: !canManage && !canDelete,
      render: (g) => (
        <div className="flex justify-end gap-1">
          {canManage && (
            <button type="button" className={iconButton} onClick={() => setFormGuest(g)} aria-label={`Edit ${g.fullName}`}>
              <Pencil className="size-4" aria-hidden />
            </button>
          )}
          {canDelete && (
            <button type="button" className={`${iconButton} hover:text-danger`} onClick={() => setDeleting(g)} aria-label={`Delete ${g.fullName}`}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guests"
        description="Guest profiles, contact details and stay history."
        actions={
          canManage && (
            <Button icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setFormGuest('new')}>
              Register guest
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            label="Search guests"
            placeholder="Search name, email, phone, guest ID…"
            value={params.search}
            onSearch={(search) => update({ search })}
            className="sm:w-80"
          />
          <FilterSelect
            label="Filter by nationality"
            allLabel="All nationalities"
            value={query.nationality ?? ''}
            options={(nationalities.data ?? []).map((n) => ({ value: n, label: n }))}
            onChange={(value) => update({ filters: { nationality: value } })}
            className="sm:w-48"
          />
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clear} className="sm:ml-auto">
              Clear filters
            </Button>
          )}
        </div>

        {guests.isPending ? (
          <div className="px-5 pb-5">
            <LoadingState label="Loading guests" rows={8} />
          </div>
        ) : guests.isError ? (
          <ErrorState message={guests.error.message} onRetry={() => void guests.refetch()} retrying={guests.isFetching} />
        ) : (
          <>
            <DataTable
              caption="Guests"
              columns={columns}
              rows={guests.data.content}
              rowKey={(g) => g.id}
              sort={params.sort}
              onSortChange={(sort) => update({ sort: sort as GuestListQuery['sort'] | null })}
              busy={guests.isPlaceholderData}
              emptyTitle={filtersActive ? 'No guests match your search' : 'No guests yet'}
              emptyDescription={filtersActive ? 'Try a different search or clear the filters.' : 'Register the first guest to get started.'}
              emptyAction={
                filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                ) : (
                  canManage && (
                    <Button size="sm" onClick={() => setFormGuest('new')}>
                      Register guest
                    </Button>
                  )
                )
              }
            />
            <Pagination
              className="border-t border-line"
              page={guests.data.page}
              size={guests.data.size}
              totalElements={guests.data.totalElements}
              totalPages={guests.data.totalPages}
              onPageChange={(page) => update({ page })}
            />
          </>
        )}
      </Card>

      <GuestFormModal open={formGuest !== null} guest={formGuest === 'new' ? undefined : (formGuest ?? undefined)} onClose={() => setFormGuest(null)} />
      <DeleteGuestDialog guest={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}
