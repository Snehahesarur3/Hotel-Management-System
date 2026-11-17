import { BedDouble, LogIn, LogOut, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/common/Badge'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Tabs } from '@/components/common/Tabs'
import { CheckInDialog } from '@/components/frontDesk/CheckInDialog'
import { CheckOutDialog } from '@/components/frontDesk/CheckOutDialog'
import { useFrontDeskOverview } from '@/hooks/useFrontDesk'
import { useReservationList } from '@/hooks/useReservations'
import type { ReservationSummary } from '@/types/dashboard'
import { canCheckIn, canCheckOut } from '@/types/frontDesk'
import { todayISO } from '@/utils/date'
import { enumLabel, formatLongDate, formatShortDate } from '@/utils/format'

const TABS = [
  { key: 'arrivals', label: 'Arrivals', icon: LogIn, empty: 'No arrivals waiting', emptyHint: 'Every booking due today has been checked in.' },
  { key: 'in-house', label: 'In-house', icon: BedDouble, empty: 'No guests in-house', emptyHint: 'Checked-in guests appear here.' },
  { key: 'departures', label: 'Departures', icon: LogOut, empty: 'No departures due', emptyHint: 'Guests due to leave today appear here.' },
] as const satisfies ReadonlyArray<{ key: string; label: string; icon: LucideIcon; empty: string; emptyHint: string }>
type TabKey = (typeof TABS)[number]['key']

const SEARCH_LIMIT = 10

export function FrontDeskPage() {
  const canManage = useCan()('frontDesk.manage')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: TabKey = TABS.find((t) => t.key === searchParams.get('tab'))?.key ?? 'arrivals'
  const search = searchParams.get('q') ?? ''
  const setParam = (key: string, value: string) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: key === 'q' },
    )

  const overview = useFrontDeskOverview()
  const results = useReservationList({ search, size: SEARCH_LIMIT }, { enabled: search !== '' })
  const [checkingIn, setCheckingIn] = useState<ReservationSummary | null>(null)
  const [checkingOut, setCheckingOut] = useState<ReservationSummary | null>(null)
  const today = overview.data?.date ?? todayISO()

  const lists: Record<TabKey, ReservationSummary[]> = {
    arrivals: overview.data?.arrivals ?? [],
    'in-house': overview.data?.inHouse ?? [],
    departures: overview.data?.departures ?? [],
  }

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
      render: (r) => (
        <div>
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
      render: (r) => (
        <span>
          {r.roomNumber} <span className="text-ink-subtle">· {enumLabel(r.roomType)}</span>
        </span>
      ),
    },
    {
      key: 'stay',
      header: 'Stay',
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="whitespace-nowrap">
            {formatShortDate(r.checkIn)} – {formatShortDate(r.checkOut)}
          </span>
          {canCheckIn(r, today) && r.checkIn < today && <Badge tone="warning">Late arrival</Badge>}
          {r.status === 'CHECKED_IN' && r.checkOut < today && <Badge tone="danger">Overdue</Badge>}
          {r.status === 'CHECKED_IN' && r.checkOut === today && <Badge tone="info">Due out today</Badge>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', hideOnMobile: true, render: (r) => <StatusBadge kind="booking" status={r.status} /> },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      hidden: !canManage,
      render: (r) =>
        canCheckIn(r, today) ? (
          <Button size="sm" icon={<LogIn className="size-3.5" aria-hidden />} onClick={() => setCheckingIn(r)} aria-label={`Check in ${r.id}`}>
            Check in
          </Button>
        ) : canCheckOut(r) ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<LogOut className="size-3.5" aria-hidden />}
            onClick={() => setCheckingOut(r)}
            aria-label={`Check out ${r.id}`}
          >
            Check out
          </Button>
        ) : null,
    },
  ]

  const activeTab = TABS.find((t) => t.key === tab)!
  return (
    <div className="space-y-6">
      <PageHeader title="Check-in / Check-out" description={`Front desk for ${formatLongDate(today)}.`} />

      <Card>
        <div className="p-4">
          <SearchInput
            label="Find a booking"
            placeholder="Find a booking by ID, guest, email or room…"
            value={search}
            onSearch={(value) => setParam('q', value)}
            className="sm:max-w-md"
          />
        </div>
        {search && (
          <div className="border-t border-line">
            <h2 className="px-5 pt-4 pb-2 text-sm font-semibold text-ink">Search results</h2>
            {results.isPending ? (
              <div className="px-5 pb-5">
                <LoadingState label="Searching bookings" rows={3} />
              </div>
            ) : results.isError ? (
              <ErrorState message={results.error.message} onRetry={() => void results.refetch()} retrying={results.isFetching} />
            ) : (
              <DataTable
                caption="Search results"
                columns={columns}
                rows={results.data.content}
                rowKey={(r) => r.id}
                busy={results.isPlaceholderData}
                emptyTitle="No bookings found"
                emptyDescription="Check the booking ID or the guest's name."
              />
            )}
          </div>
        )}
      </Card>

      <Card>
        <Tabs
          label="Front desk lists"
          idPrefix="front-desk"
          tabs={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon, count: overview.data ? lists[t.key].length : undefined }))}
          value={tab}
          onChange={(key) => setParam('tab', key === 'arrivals' ? '' : key)}
        >
          {overview.isPending ? (
            <div className="p-5">
              <LoadingState label="Loading front desk" rows={6} />
            </div>
          ) : overview.isError ? (
            <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} retrying={overview.isFetching} />
          ) : (
            <DataTable
              caption={activeTab.label}
              columns={columns}
              rows={lists[tab]}
              rowKey={(r) => r.id}
              emptyTitle={activeTab.empty}
              emptyDescription={activeTab.emptyHint}
            />
          )}
        </Tabs>
      </Card>

      <CheckInDialog reservation={checkingIn} onClose={() => setCheckingIn(null)} />
      <CheckOutDialog reservation={checkingOut} onClose={() => setCheckingOut(null)} />
    </div>
  )
}
