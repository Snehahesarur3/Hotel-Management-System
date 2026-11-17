import { ArrowLeft, Ban, BedDouble, LogIn, LogOut, Mail, Pencil, Phone, SearchX, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CancelReservationDialog } from '@/components/bookings/CancelReservationDialog'
import { ReservationFormModal } from '@/components/bookings/ReservationFormModal'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState, ErrorState, Skeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { CheckInDialog } from '@/components/frontDesk/CheckInDialog'
import { CheckOutDialog } from '@/components/frontDesk/CheckOutDialog'
import { useReservation } from '@/hooks/useReservations'
import { ApiError } from '@/types/api'
import type { ReservationSummary } from '@/types/dashboard'
import { canCheckIn, canCheckOut } from '@/types/frontDesk'
import { isEditableBooking } from '@/types/reservation'
import { todayISO } from '@/utils/date'
import { enumLabel, formatCurrency, formatDateTime, formatLongDate } from '@/utils/format'

function Row({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2 ${strong ? 'font-semibold text-ink' : ''}`}>
      <dt className={strong ? 'text-ink' : 'text-ink-muted'}>{label}</dt>
      <dd className="text-right text-ink tabular-nums">{children}</dd>
    </div>
  )
}

const STATUS_NOTE: Record<string, string> = {
  PENDING: 'Awaiting guarantee. Confirm it by editing the booking.',
  CONFIRMED: 'Guaranteed booking. Check in from the arrival date.',
  CHECKED_IN: 'Guest is in-house. Check out from here or the front desk.',
  CHECKED_OUT: 'Stay completed.',
  CANCELLED: 'Cancelled. The room was released for these dates.',
}

export function ReservationDetailsPage() {
  const can = useCan()
  const { reservationId = '' } = useParams()
  const reservation = useReservation(reservationId)
  const [editing, setEditing] = useState<ReservationSummary | null>(null)
  const [cancelling, setCancelling] = useState<ReservationSummary | null>(null)
  const [checkingIn, setCheckingIn] = useState<ReservationSummary | null>(null)
  const [checkingOut, setCheckingOut] = useState<ReservationSummary | null>(null)

  const backLink = (
    <Link to="/reservations" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Reservations
    </Link>
  )

  if (reservation.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading reservation">
        {backLink}
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </div>
    )
  }
  if (reservation.isError) {
    const notFound = reservation.error instanceof ApiError && reservation.error.status === 404
    return (
      <div className="space-y-6">
        {backLink}
        <Card>
          {notFound ? (
            <EmptyState icon={SearchX} title="Reservation not found" description="Check the booking ID and try again." className="py-16" />
          ) : (
            <ErrorState message={reservation.error.message} onRetry={() => void reservation.refetch()} retrying={reservation.isFetching} />
          )}
        </Card>
      </div>
    )
  }

  const r = reservation.data
  const editable = isEditableBooking(r)
  return (
    <div className="space-y-6">
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Booking {r.id}</h1>
            <StatusBadge kind="booking" status={r.status} />
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">
            {enumLabel(r.source)} · booked {formatDateTime(r.createdAt)}
          </p>
        </div>
        {((editable && can('reservations.manage')) || (canCheckOut(r) && can('frontDesk.manage'))) && (
          <div className="flex flex-wrap gap-2">
            {canCheckIn(r, todayISO()) && can('frontDesk.manage') && (
              <Button icon={<LogIn className="size-4" aria-hidden />} onClick={() => setCheckingIn(r)}>
                Check in
              </Button>
            )}
            {canCheckOut(r) && can('frontDesk.manage') && (
              <Button icon={<LogOut className="size-4" aria-hidden />} onClick={() => setCheckingOut(r)}>
                Check out
              </Button>
            )}
            {editable && can('reservations.manage') && (
              <>
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(r)}>
                  Edit
                </Button>
                <Button variant="danger-outline" icon={<Ban className="size-4" aria-hidden />} onClick={() => setCancelling(r)}>
                  Cancel booking
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Stay" subtitle={STATUS_NOTE[r.status]} />
            <CardBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-canvas px-4 py-3">
                  <p className="text-xs text-ink-muted">Check-in</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{formatLongDate(r.checkIn)}</p>
                </div>
                <div className="rounded-lg bg-canvas px-4 py-3">
                  <p className="text-xs text-ink-muted">Check-out</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{formatLongDate(r.checkOut)}</p>
                </div>
                <div className="rounded-lg bg-canvas px-4 py-3">
                  <p className="text-xs text-ink-muted">Length & party</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">
                    {r.nights} night{r.nights > 1 ? 's' : ''} · {r.numberOfGuests} guest{r.numberOfGuests > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Payments"
              subtitle="Recorded against this booking."
              actions={
                <Link to={`/billing/invoices/${r.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  Open invoice
                </Link>
              }
            />
            <DataTable
              caption="Payments"
              rows={r.payments}
              rowKey={(p) => p.id}
              emptyTitle="No payments recorded"
              columns={[
                { key: 'id', header: 'Payment', render: (p) => <span className="font-medium">{p.id}</span> },
                { key: 'date', header: 'Date', render: (p) => formatDateTime(p.paymentDate) },
                { key: 'method', header: 'Method', hideOnMobile: true, render: (p) => enumLabel(p.method) },
                { key: 'amount', header: 'Amount', align: 'right', render: (p) => formatCurrency(p.amount) },
                { key: 'status', header: 'Status', render: (p) => <StatusBadge kind="payment" status={p.status} /> },
              ]}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Guest" />
            <CardBody className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <UserRound className="size-4 text-ink-subtle" aria-hidden />
                <Link to={`/guests/${r.guestId}`} className="font-medium text-brand-700 hover:underline">
                  {r.guestName}
                </Link>
              </p>
              {r.guestEmail && (
                <p className="flex items-center gap-2 break-all text-ink-muted">
                  <Mail className="size-4 shrink-0 text-ink-subtle" aria-hidden /> {r.guestEmail}
                </p>
              )}
              {r.guestPhone && (
                <p className="flex items-center gap-2 text-ink-muted">
                  <Phone className="size-4 shrink-0 text-ink-subtle" aria-hidden /> {r.guestPhone}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Room" />
            <CardBody className="text-sm">
              <p className="flex items-center gap-2">
                <BedDouble className="size-4 text-ink-subtle" aria-hidden />
                <Link to={`/rooms/${r.roomId}`} className="font-medium text-brand-700 hover:underline">
                  Room {r.roomNumber}
                </Link>
                <span className="text-ink-muted">· {enumLabel(r.roomType)}</span>
              </p>
              <p className="mt-1 text-ink-muted">
                Floor {r.roomFloor} · sleeps up to {r.roomCapacity}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Charges" subtitle="Rate locked in at booking" />
            <CardBody>
              <dl className="divide-y divide-line text-sm">
                <Row label={`${r.quote.nights} night${r.quote.nights > 1 ? 's' : ''} × ${formatCurrency(r.quote.roomRate)}`}>
                  {formatCurrency(r.quote.roomCharges)}
                </Row>
                <Row label={`GST ${r.quote.gstPercent}%`}>{formatCurrency(r.quote.gstAmount)}</Row>
                <Row label="Room total incl. GST" strong>
                  {formatCurrency(r.quote.total)}
                </Row>
                <Row label="Paid">{formatCurrency(r.amountPaid)}</Row>
              </dl>
              <p className="mt-2 text-xs text-ink-subtle">
                Room charges only. Restaurant, extras, discounts and the balance are on the{' '}
                <Link to={`/billing/invoices/${r.id}`} className="font-medium text-brand-700 hover:underline">
                  invoice
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <ReservationFormModal open={editing !== null} reservation={editing ?? undefined} onClose={() => setEditing(null)} />
      <CancelReservationDialog reservation={cancelling} onClose={() => setCancelling(null)} />
      <CheckInDialog reservation={checkingIn} onClose={() => setCheckingIn(null)} />
      <CheckOutDialog reservation={checkingOut} onClose={() => setCheckingOut(null)} />
    </div>
  )
}
