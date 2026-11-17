import { Ban, CalendarClock, CalendarRange, MoonStar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useReservationReport } from '@/hooks/useReports'
import type { ReservationSummary } from '@/types/dashboard'
import type { ReportRange, ReservationReport, ReservationSourceRow } from '@/types/reports'
import { enumLabel, formatCurrency, formatDate, formatNumber, formatPercent } from '@/utils/format'
import { RankedBarChart } from './RankedBarChart'
import { ReportQuery, StatGrid } from './ReportLayout'
import { ReportTable, type ReportColumn } from './ReportTable'

export function ReservationReportView({ range }: { range: ReportRange }) {
  const report = useReservationReport(range)
  return <ReportQuery query={report}>{(data) => <ReservationContent report={data} />}</ReportQuery>
}

const sourceColumns: ReportColumn<ReservationSourceRow>[] = [
  { key: 'source', header: 'Source', render: (s) => enumLabel(s.key), csv: (s) => enumLabel(s.key) },
  { key: 'reservations', header: 'Reservations', align: 'right', render: (s) => s.reservations, csv: (s) => s.reservations },
  { key: 'cancelled', header: 'Cancelled', align: 'right', render: (s) => s.cancelled, csv: (s) => s.cancelled },
  { key: 'nights', header: 'Room nights', align: 'right', render: (s) => s.roomNights, csv: (s) => s.roomNights, hideOnMobile: true },
  { key: 'revenue', header: 'Room revenue', align: 'right', render: (s) => formatCurrency(s.roomRevenue), csv: (s) => s.roomRevenue },
]

const bookingColumns: ReportColumn<ReservationSummary>[] = [
  {
    key: 'id',
    header: 'Booking',
    render: (r) => (
      <Link to={`/reservations/${r.id}`} className="font-medium text-brand-700 hover:underline">
        {r.id}
      </Link>
    ),
    csv: (r) => r.id,
  },
  {
    key: 'guest',
    header: 'Guest',
    render: (r) => (
      <Link to={`/guests/${r.guestId}`} className="text-ink hover:text-brand-700 hover:underline">
        {r.guestName}
      </Link>
    ),
    csv: (r) => r.guestName,
  },
  { key: 'room', header: 'Room', render: (r) => r.roomNumber, csv: (r) => r.roomNumber, hideOnMobile: true },
  { key: 'roomType', header: 'Room type', csv: (r) => enumLabel(r.roomType), exportOnly: true },
  { key: 'checkIn', header: 'Arrival', render: (r) => formatDate(r.checkIn), csv: (r) => r.checkIn },
  { key: 'checkOut', header: 'Departure', render: (r) => formatDate(r.checkOut), csv: (r) => r.checkOut, hideOnMobile: true },
  { key: 'nights', header: 'Nights', align: 'right', render: (r) => r.nights, csv: (r) => r.nights, hideOnMobile: true },
  { key: 'guests', header: 'Guests', csv: (r) => r.numberOfGuests, exportOnly: true },
  { key: 'source', header: 'Source', render: (r) => enumLabel(r.source), csv: (r) => enumLabel(r.source), hideOnMobile: true },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge kind="booking" status={r.status} />, csv: (r) => enumLabel(r.status) },
  { key: 'amount', header: 'Room charges', align: 'right', render: (r) => formatCurrency(r.totalAmount), csv: (r) => r.totalAmount, hideOnMobile: true },
  { key: 'createdAt', header: 'Booked on', csv: (r) => r.createdAt.slice(0, 10), exportOnly: true },
]

function ReservationContent({ report }: { report: ReservationReport }) {
  const { totals } = report
  return (
    <>
      <StatGrid>
        <StatCard
          label="Reservations"
          value={formatNumber(totals.reservations)}
          icon={CalendarRange}
          hint={`${formatNumber(totals.roomNights)} room nights · ${formatCurrency(totals.roomRevenue, { whole: true })}`}
        />
        <StatCard label="Cancellation rate" value={formatPercent(totals.cancellationRate)} icon={Ban} hint={`${totals.cancelled} cancelled`} />
        <StatCard label="Average stay" value={`${totals.averageStay} nights`} icon={MoonStar} hint={`${totals.averageGuests} guests per booking on average`} />
        <StatCard label="Average lead time" value={`${totals.averageLeadTime} days`} icon={CalendarClock} hint="From booking to arrival" />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankedBarChart
          title="Reservations by status"
          subtitle="Current status of the bookings arriving in this range"
          data={report.byStatus.map((s) => ({ key: s.key, label: enumLabel(s.key), value: s.count }))}
          valueLabel="Reservations"
          format={formatNumber}
        />
        <RankedBarChart
          title="Reservations by source"
          subtitle="Including cancelled bookings"
          data={report.bySource.map((s) => ({ key: s.key, label: enumLabel(s.key), value: s.reservations }))}
          valueLabel="Reservations"
          format={formatNumber}
        />
      </div>

      <ReportTable
        title="Booking sources"
        subtitle="Room nights and revenue exclude cancelled bookings"
        range={report}
        rows={report.bySource}
        columns={sourceColumns}
        rowKey={(s) => s.key}
      />

      <ReportTable
        title="Reservations arriving"
        subtitle="Every booking with a check-in date in this range, in arrival order"
        range={report}
        rows={report.rows}
        columns={bookingColumns}
        rowKey={(r) => r.id}
        emptyTitle="No arrivals in this date range"
        scroll
      />
    </>
  )
}
