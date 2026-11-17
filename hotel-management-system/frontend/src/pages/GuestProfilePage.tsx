import { ArrowLeft, CalendarCheck, CalendarPlus, IndianRupee, Mail, MapPin, Moon, Pencil, Phone, SearchX, ShieldCheck, Trash2, Globe2, BedDouble } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ReservationFormModal } from '@/components/bookings/ReservationFormModal'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { DataTable } from '@/components/common/DataTable'
import { StatCard } from '@/components/common/StatCard'
import { EmptyState, ErrorState, LoadingState, Skeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DeleteGuestDialog } from '@/components/guests/DeleteGuestDialog'
import { GuestFormModal } from '@/components/guests/GuestFormModal'
import { useGuest, useGuestHistory } from '@/hooks/useGuests'
import { ApiError } from '@/types/api'
import type { GuestSummary } from '@/types/guest'
import { enumLabel, formatCurrency, formatDate, formatShortDate } from '@/utils/format'

function ContactRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className="text-sm break-words text-ink">{children}</dd>
      </div>
    </div>
  )
}

export function GuestProfilePage() {
  const can = useCan()
  const { guestId = '' } = useParams()
  const navigate = useNavigate()
  const guest = useGuest(guestId)
  const history = useGuestHistory(guestId)
  const [editing, setEditing] = useState<GuestSummary | null>(null)
  const [deleting, setDeleting] = useState<GuestSummary | null>(null)
  const [booking, setBooking] = useState(false)

  const backLink = (
    <Link to="/guests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Guests
    </Link>
  )

  if (guest.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading guest">
        {backLink}
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </div>
    )
  }
  if (guest.isError) {
    const notFound = guest.error instanceof ApiError && guest.error.status === 404
    return (
      <div className="space-y-6">
        {backLink}
        <Card>
          {notFound ? (
            <EmptyState icon={SearchX} title="Guest not found" description="The profile may have been deleted." className="py-16" />
          ) : (
            <ErrorState message={guest.error.message} onRetry={() => void guest.refetch()} retrying={guest.isFetching} />
          )}
        </Card>
      </div>
    )
  }

  const g = guest.data
  const stats = history.data?.stats
  return (
    <div className="space-y-6">
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-100 text-base font-semibold text-brand-700" aria-hidden>
            {g.fullName
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">{g.fullName}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {g.id} · Guest since {formatDate(g.registrationDate)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('reservations.manage') && (
            <Button icon={<CalendarPlus className="size-4" aria-hidden />} onClick={() => setBooking(true)}>
              New booking
            </Button>
          )}
          {can('guests.manage') && (
            <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(g)}>
              Edit
            </Button>
          )}
          {can('guests.delete') && (
            <Button variant="danger-outline" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDeleting(g)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {history.isError ? (
        <Card>
          <ErrorState message={history.error.message} onRetry={() => void history.refetch()} retrying={history.isFetching} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {stats ? (
            <>
              <StatCard label="Completed stays" value={stats.completedStays} icon={BedDouble} hint={`${stats.totalReservations} reservations in total`} />
              <StatCard label="Nights stayed" value={stats.nightsStayed} icon={Moon} hint="Across completed stays" />
              <StatCard label="Total spent" value={formatCurrency(stats.totalSpent, { whole: true })} icon={IndianRupee} hint="Completed payments" />
              <StatCard label="Upcoming stays" value={stats.upcomingStays} icon={CalendarCheck} hint={`${stats.cancelled} cancelled`} />
            </>
          ) : (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-[var(--radius-card)]" />)
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:order-2">
          <CardHeader title="Contact & identity" />
          <CardBody>
            <dl className="divide-y divide-line">
              <ContactRow icon={Mail} label="Email">
                <a href={`mailto:${g.email}`} className="text-brand-700 hover:underline">
                  {g.email}
                </a>
              </ContactRow>
              <ContactRow icon={Phone} label="Phone">
                {g.phone}
              </ContactRow>
              <ContactRow icon={MapPin} label="Address">
                {g.address}
              </ContactRow>
              <ContactRow icon={Globe2} label="Nationality">
                {g.nationality}
              </ContactRow>
              <ContactRow icon={ShieldCheck} label={enumLabel(g.idProofType)}>
                <span className="font-mono text-xs">{g.idProofNumber}</span>
                <span className="block text-xs text-ink-subtle">Masked: only the last 4 characters are kept</span>
              </ContactRow>
            </dl>
          </CardBody>
        </Card>

        <Card className="min-w-0 xl:order-1 xl:col-span-2">
          <CardHeader title="Booking history" subtitle="All reservations, most recent first" />
          {history.isPending ? (
            <CardBody>
              <LoadingState label="Loading booking history" rows={5} />
            </CardBody>
          ) : history.isError ? null : (
            <DataTable
              caption="Booking history"
              rows={history.data.reservations}
              rowKey={(r) => r.id}
              emptyTitle="No reservations yet"
              columns={[
                { key: 'id', header: 'Booking', render: (r) => <Link to={`/reservations/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.id}</Link> },
                {
                  key: 'room',
                  header: 'Room',
                  render: (r) => (
                    <span>
                      {r.roomNumber} <span className="text-ink-subtle">· {enumLabel(r.roomType)}</span>
                    </span>
                  ),
                },
                { key: 'stay', header: 'Stay', render: (r) => `${formatShortDate(r.checkIn)} – ${formatShortDate(r.checkOut)}` },
                { key: 'nights', header: 'Nights', align: 'right', hideOnMobile: true, render: (r) => r.nights },
                { key: 'total', header: 'Room total', align: 'right', hideOnMobile: true, render: (r) => formatCurrency(r.totalAmount, { whole: true }) },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="booking" status={r.status} /> },
              ]}
            />
          )}
        </Card>
      </div>

      <ReservationFormModal
        open={booking}
        guest={{ id: g.id, fullName: g.fullName, detail: g.email }}
        onClose={() => setBooking(false)}
        onSaved={(r) => navigate(`/reservations/${r.id}`)}
      />
      <GuestFormModal open={editing !== null} guest={editing ?? undefined} onClose={() => setEditing(null)} />
      <DeleteGuestDialog guest={deleting} onClose={() => setDeleting(null)} onDeleted={() => navigate('/guests')} />
    </div>
  )
}
