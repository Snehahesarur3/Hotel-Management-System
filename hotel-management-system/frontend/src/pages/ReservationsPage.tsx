import { Ban, CalendarPlus, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CancelReservationDialog } from '@/components/bookings/CancelReservationDialog'
import { ReservationFormModal } from '@/components/bookings/ReservationFormModal'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TextInput } from '@/components/common/FormControls'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useListParams } from '@/hooks/useListParams'
import { useReservationList } from '@/hooks/useReservations'
import type { ReservationSummary } from '@/types/dashboard'
import { BOOKING_SOURCES, BOOKING_STATUSES, type BookingSource, type BookingStatus } from '@/types/enums'
import { isEditableBooking, type ReservationListQuery, type ReservationSortField } from '@/types/reservation'
import { enumLabel, formatCurrency, formatDate, formatShortDate } from '@/utils/format'

const FILTER_KEYS = ['status', 'source', 'from', 'to'] as const
const SORT_FIELDS: readonly ReservationSortField[] = ['checkIn', 'checkOut', 'createdAt', 'guestName', 'roomNumber', 'totalAmount', 'status']
const PAGE_SIZE = 15
const ISO = /^\d{4}-\d{2}-\d{2}$/

const iconButton =
  'grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600'

const oneOf = <T extends string>(values: readonly T[], value: string) => ((values as readonly string[]).includes(value) ? (value as T) : undefined)

export function ReservationsPage() {
  const { params, update, clear } = useListParams(FILTER_KEYS, SORT_FIELDS)
  const can = useCan()
  const canManage = can('reservations.manage')
  const { status, source, from, to } = params.filters
  const query: ReservationListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    status: oneOf<BookingStatus>(BOOKING_STATUSES, status ?? ''),
    source: oneOf<BookingSource>(BOOKING_SOURCES, source ?? ''),
    from: ISO.test(from ?? '') ? from : undefined,
    to: ISO.test(to ?? '') ? to : undefined,
  }
  const reservations = useReservationList(query)
  const [formTarget, setFormTarget] = useState<ReservationSummary | 'new' | null>(null)
  const [cancelling, setCancelling] = useState<ReservationSummary | null>(null)
  const filtersActive = Boolean(params.search || query.status || query.source || query.from || query.to)

  const lastPage = reservations.data && reservations.data.totalPages > 0 ? reservations.data.totalPages - 1 : 0
  const pageOutOfRange = Boolean(reservations.data && !reservations.isPlaceholderData && params.page > lastPage)
  useEffect(() => {
    if (pageOutOfRange) update({ page: lastPage })
  }, [pageOutOfRange, lastPage, update])

  const columns: Column<ReservationSummary>[] = [
    {
      key: 'id',
      header: 'Booking',
      render: (r) => (
        <Link to={`/reservations/${r.id}`} className="font-medium text-brand-700 hover:underline">
          {r.id}
        </Link>
      ),
    },
    {
      key: 'guest',
      header: 'Guest',
      sortField: 'guestName',
      render: (r) => (
        <div className="min-w-0">
          <Link to={`/guests/${r.guestId}`} className="text-ink hover:text-brand-700 hover:underline">
            {r.guestName}
          </Link>
          <p className="text-xs text-ink-muted">
            {r.numberOfGuests} guest{r.numberOfGuests > 1 ? 's' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      sortField: 'roomNumber',
      render: (r) => (
        <span>
          <Link to={`/rooms/${r.roomId}`} className="text-ink hover:text-brand-700 hover:underline">
            {r.roomNumber}
          </Link>{' '}
          <span className="text-ink-subtle">· {enumLabel(r.roomType)}</span>
        </span>
      ),
    },
    {
      key: 'stay',
      header: 'Stay',
      sortField: 'checkIn',
      render: (r) => (
        <div>
          <span className="whitespace-nowrap">
            {formatShortDate(r.checkIn)} – {formatShortDate(r.checkOut)}
          </span>
          <p className="text-xs text-ink-muted">
            {r.nights} night{r.nights > 1 ? 's' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Room total',
      sortField: 'totalAmount',
      align: 'right',
      hideOnMobile: true,
      render: (r) => formatCurrency(r.totalAmount, { whole: true }),
    },
    { key: 'source', header: 'Source', hideOnMobile: true, render: (r) => <span className="text-ink-muted">{enumLabel(r.source)}</span> },
    { key: 'booked', header: 'Booked', sortField: 'createdAt', hideOnMobile: true, render: (r) => <span className="text-ink-muted">{formatDate(r.createdAt)}</span> },
    { key: 'status', header: 'Status', sortField: 'status', render: (r) => <StatusBadge kind="booking" status={r.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      hidden: !canManage,
      render: (r) =>
        isEditableBooking(r) ? (
          <div className="flex justify-end gap-1">
            <button type="button" className={iconButton} onClick={() => setFormTarget(r)} aria-label={`Edit booking ${r.id}`}>
              <Pencil className="size-4" aria-hidden />
            </button>
            <button type="button" className={`${iconButton} hover:text-danger`} onClick={() => setCancelling(r)} aria-label={`Cancel booking ${r.id}`}>
              <Ban className="size-4" aria-hidden />
            </button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Bookings, availability and cancellations."
        actions={
          canManage && (
            <Button icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => setFormTarget('new')}>
              New reservation
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput
            label="Search reservations"
            placeholder="Search booking, guest, room…"
            value={params.search}
            onSearch={(search) => update({ search })}
            className="lg:w-72"
          />
          <FilterSelect
            label="Filter by status"
            allLabel="All statuses"
            value={query.status ?? ''}
            options={BOOKING_STATUSES.map((s) => ({ value: s, label: enumLabel(s) }))}
            onChange={(value) => update({ filters: { status: value } })}
            className="lg:w-40"
          />
          <FilterSelect
            label="Filter by source"
            allLabel="All sources"
            value={query.source ?? ''}
            options={BOOKING_SOURCES.map((s) => ({ value: s, label: enumLabel(s) }))}
            onChange={(value) => update({ filters: { source: value } })}
            className="lg:w-40"
          />
          <div className="flex min-w-0 items-center gap-2">
            <TextInput
              type="date"
              aria-label="Stays from"
              title="Stays in the hotel on or after this date"
              value={query.from ?? ''}
              max={query.to}
              onChange={(e) => update({ filters: { from: e.target.value } })}
              className="min-w-0 flex-1 lg:w-40 lg:flex-none"
            />
            <span className="text-sm text-ink-subtle" aria-hidden>
              to
            </span>
            <TextInput
              type="date"
              aria-label="Stays to"
              title="Stays in the hotel on or before this date"
              value={query.to ?? ''}
              min={query.from}
              onChange={(e) => update({ filters: { to: e.target.value } })}
              className="min-w-0 flex-1 lg:w-40 lg:flex-none"
            />
          </div>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clear} className="lg:ml-auto">
              Clear filters
            </Button>
          )}
        </div>

        {reservations.isPending ? (
          <div className="px-5 pb-5">
            <LoadingState label="Loading reservations" rows={8} />
          </div>
        ) : reservations.isError ? (
          <ErrorState message={reservations.error.message} onRetry={() => void reservations.refetch()} retrying={reservations.isFetching} />
        ) : (
          <>
            <DataTable
              caption="Reservations"
              columns={columns}
              rows={reservations.data.content}
              rowKey={(r) => r.id}
              sort={params.sort}
              onSortChange={(sort) => update({ sort: sort as ReservationListQuery['sort'] | null })}
              busy={reservations.isPlaceholderData}
              emptyTitle={filtersActive ? 'No reservations match your filters' : 'No reservations yet'}
              emptyDescription={filtersActive ? 'Try a different search, status or date range.' : 'Create the first booking to get started.'}
              emptyAction={
                filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                ) : (
                  canManage && (
                    <Button size="sm" onClick={() => setFormTarget('new')}>
                      New reservation
                    </Button>
                  )
                )
              }
            />
            <Pagination
              className="border-t border-line"
              page={reservations.data.page}
              size={reservations.data.size}
              totalElements={reservations.data.totalElements}
              totalPages={reservations.data.totalPages}
              onPageChange={(page) => update({ page })}
            />
          </>
        )}
      </Card>

      <ReservationFormModal
        open={formTarget !== null}
        reservation={formTarget === 'new' ? undefined : (formTarget ?? undefined)}
        onClose={() => setFormTarget(null)}
      />
      <CancelReservationDialog reservation={cancelling} onClose={() => setCancelling(null)} />
    </div>
  )
}
