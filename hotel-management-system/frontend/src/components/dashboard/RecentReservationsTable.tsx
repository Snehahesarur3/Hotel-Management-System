import { Card, CardHeader } from '@/components/common/Card'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { ReservationSummary } from '@/types/dashboard'
import { enumLabel, formatCurrency, formatShortDate } from '@/utils/format'
import { ModuleLink } from '@/components/common/ModuleLink'

export function RecentReservationsTable({ reservations, className }: { reservations: ReservationSummary[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Recent reservations" subtitle="Latest bookings by creation date" />
      <DataTable
        caption="Recent reservations"
        rows={reservations}
        rowKey={(r) => r.id}
        emptyTitle="No reservations yet"
        columns={[
          { key: 'id', header: 'Booking', render: (r) => <ModuleLink to={`/reservations/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.id}</ModuleLink> },
          { key: 'guest', header: 'Guest', render: (r) => r.guestName },
          {
            key: 'room',
            header: 'Room',
            hideOnMobile: true,
            render: (r) => (
              <span>
                {r.roomNumber} <span className="text-ink-subtle">· {enumLabel(r.roomType)}</span>
              </span>
            ),
          },
          {
            key: 'stay',
            header: 'Stay',
            hideOnMobile: true,
            render: (r) => `${formatShortDate(r.checkIn)} – ${formatShortDate(r.checkOut)}`,
          },
          { key: 'amount', header: 'Room total', align: 'right', render: (r) => formatCurrency(r.totalAmount, { whole: true }) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="booking" status={r.status} /> },
        ]}
      />
    </Card>
  )
}
