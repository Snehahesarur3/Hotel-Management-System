import { ArrowLeft, BedDouble, CalendarClock, History, Pencil, RefreshCcw, SearchX, Sparkles, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/common/Badge'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState, ErrorState, LoadingState, Skeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DeleteRoomDialog } from '@/components/rooms/DeleteRoomDialog'
import { RoomFormModal } from '@/components/rooms/RoomFormModal'
import { RoomStatusDialog } from '@/components/rooms/RoomStatusDialog'
import { useRoom, useRoomActivity } from '@/hooks/useRooms'
import { ApiError } from '@/types/api'
import type { ReservationSummary } from '@/types/dashboard'
import type { Room } from '@/types/domain'
import { enumLabel, formatCurrency, formatDate, formatShortDate } from '@/utils/format'
import { ModuleLink } from '@/components/common/ModuleLink'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  )
}

function StayTable({ stays, caption, emptyTitle }: { stays: ReservationSummary[]; caption: string; emptyTitle: string }) {
  return (
    <DataTable
      caption={caption}
      rows={stays}
      rowKey={(s) => s.id}
      emptyTitle={emptyTitle}
      columns={[
        { key: 'id', header: 'Booking', render: (s) => <ModuleLink to={`/reservations/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.id}</ModuleLink> },
        {
          key: 'guest',
          header: 'Guest',
          render: (s) => (
            <ModuleLink to={`/guests/${s.guestId}`} className="text-brand-700 hover:underline">
              {s.guestName}
            </ModuleLink>
          ),
        },
        { key: 'dates', header: 'Stay', render: (s) => `${formatShortDate(s.checkIn)} – ${formatShortDate(s.checkOut)}` },
        { key: 'nights', header: 'Nights', align: 'right', hideOnMobile: true, render: (s) => s.nights },
        { key: 'status', header: 'Status', render: (s) => <StatusBadge kind="booking" status={s.status} /> },
      ]}
    />
  )
}

export function RoomDetailsPage() {
  const can = useCan()
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const room = useRoom(roomId)
  const activity = useRoomActivity(roomId)
  const [editing, setEditing] = useState<Room | null>(null)
  const [changingStatus, setChangingStatus] = useState<Room | null>(null)
  const [deleting, setDeleting] = useState<Room | null>(null)

  const backLink = (
    <ModuleLink to="/rooms" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Rooms
    </ModuleLink>
  )

  if (room.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading room">
        {backLink}
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
      </div>
    )
  }
  if (room.isError) {
    const notFound = room.error instanceof ApiError && room.error.status === 404
    return (
      <div className="space-y-6">
        {backLink}
        <Card>
          {notFound ? (
            <EmptyState icon={SearchX} title="Room not found" description="It may have been deleted." className="py-16" />
          ) : (
            <ErrorState message={room.error.message} onRetry={() => void room.refetch()} retrying={room.isFetching} />
          )}
        </Card>
      </div>
    )
  }

  const r = room.data
  return (
    <div className="space-y-6">
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Room {r.roomNumber}</h1>
            <StatusBadge kind="room" status={r.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {enumLabel(r.type)} · Floor {r.floor} · up to {r.capacity} {r.capacity === 1 ? 'guest' : 'guests'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('rooms.status') && (
            <Button variant="secondary" icon={<RefreshCcw className="size-4" aria-hidden />} onClick={() => setChangingStatus(r)}>
              Change status
            </Button>
          )}
          {can('rooms.manage') && (
            <>
              <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(r)}>
                Edit
              </Button>
              <Button variant="danger-outline" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDeleting(r)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {activity.isPending ? (
            <Card className="p-5">
              <LoadingState label="Loading room activity" rows={6} />
            </Card>
          ) : activity.isError ? (
            <Card>
              <ErrorState message={activity.error.message} onRetry={() => void activity.refetch()} retrying={activity.isFetching} />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader title="Current stay" />
                {activity.data.currentStay ? (
                  <CardBody>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-canvas px-4 py-3">
                      <div>
                        <ModuleLink to={`/guests/${activity.data.currentStay.guestId}`} className="font-medium text-brand-700 hover:underline">
                          {activity.data.currentStay.guestName}
                        </ModuleLink>
                        <p className="text-xs text-ink-muted">
                          {activity.data.currentStay.id} · {formatDate(activity.data.currentStay.checkIn)} –{' '}
                          {formatDate(activity.data.currentStay.checkOut)} · {activity.data.currentStay.numberOfGuests} guests
                        </p>
                      </div>
                      <StatusBadge kind="booking" status={activity.data.currentStay.status} />
                    </div>
                  </CardBody>
                ) : (
                  <EmptyState icon={BedDouble} title="No guest in-house" className="py-6" />
                )}
              </Card>
              <Card>
                <CardHeader title="Upcoming reservations" subtitle="Pending and confirmed stays, soonest first" />
                <StayTable stays={activity.data.upcoming} caption="Upcoming reservations" emptyTitle="No upcoming reservations" />
              </Card>
              <Card>
                <CardHeader title="Stay history" subtitle="Completed and cancelled stays" />
                <StayTable stays={activity.data.history} caption="Stay history" emptyTitle="No past stays" />
              </Card>
            </>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Room details" />
            <CardBody>
              <dl className="divide-y divide-line text-sm">
                <Detail label="Type">{enumLabel(r.type)}</Detail>
                <Detail label="Floor">{r.floor}</Detail>
                <Detail label="Capacity">{r.capacity} guests</Detail>
                <Detail label="Price per night">{formatCurrency(r.pricePerNight)}</Detail>
              </dl>
              {r.amenities.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-sm text-ink-muted">Amenities</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {r.amenities.map((a) => (
                      <li key={a}>
                        <Badge>{a}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {r.description && <p className="mt-4 text-sm text-ink-muted">{r.description}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Housekeeping" subtitle="Open tasks first" />
            {activity.isPending ? (
              <CardBody>
                <LoadingState rows={3} />
              </CardBody>
            ) : activity.isError ? null : activity.data.housekeeping.length === 0 ? (
              <EmptyState icon={Sparkles} title="No housekeeping tasks" className="py-6" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {activity.data.housekeeping.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{enumLabel(t.taskType)}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
                        <CalendarClock className="size-3" aria-hidden /> {formatShortDate(t.scheduledDate)} · {t.assignee}
                      </p>
                    </div>
                    <StatusBadge kind="housekeeping" status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {activity.data && activity.data.history.length + activity.data.upcoming.length > 0 && (
            <p className="flex items-center gap-1.5 px-1 text-xs text-ink-subtle">
              <History className="size-3.5" aria-hidden /> Rooms with history can’t be deleted; set them to Maintenance instead.
            </p>
          )}
        </div>
      </div>

      <RoomFormModal open={editing !== null} room={editing ?? undefined} onClose={() => setEditing(null)} />
      <RoomStatusDialog room={changingStatus} onClose={() => setChangingStatus(null)} />
      <DeleteRoomDialog room={deleting} onClose={() => setDeleting(null)} onDeleted={() => navigate('/rooms')} />
    </div>
  )
}
