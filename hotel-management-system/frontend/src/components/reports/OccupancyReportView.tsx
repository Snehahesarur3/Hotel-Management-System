import { BedDouble, IndianRupee, Percent, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatCard } from '@/components/common/StatCard'
import { useOccupancyReport } from '@/hooks/useReports'
import type { OccupancyReport, ReportRange, RoomPerformance, RoomTypePerformance } from '@/types/reports'
import { enumLabel, formatCurrency, formatDate, formatNumber, formatPercent } from '@/utils/format'
import { OccupancyReportChart } from './OccupancyReportChart'
import { ReportQuery, StatGrid } from './ReportLayout'
import { ReportTable, type ReportColumn } from './ReportTable'

const whole = (amount: number) => formatCurrency(amount, { whole: true })

export function OccupancyReportView({ range }: { range: ReportRange }) {
  const report = useOccupancyReport(range)
  return <ReportQuery query={report}>{(data) => <OccupancyContent report={data} />}</ReportQuery>
}

const typeColumns: ReportColumn<RoomTypePerformance>[] = [
  { key: 'type', header: 'Room type', render: (t) => enumLabel(t.type), csv: (t) => enumLabel(t.type) },
  { key: 'rooms', header: 'Rooms', align: 'right', render: (t) => t.rooms, csv: (t) => t.rooms, hideOnMobile: true },
  {
    key: 'sold',
    header: 'Room nights sold',
    align: 'right',
    render: (t) => `${formatNumber(t.roomNightsSold)} / ${formatNumber(t.roomNightsAvailable)}`,
    csv: (t) => t.roomNightsSold,
  },
  { key: 'available', header: 'Room nights available', csv: (t) => t.roomNightsAvailable, exportOnly: true },
  { key: 'occupancy', header: 'Occupancy %', align: 'right', render: (t) => formatPercent(t.occupancyRate), csv: (t) => t.occupancyRate },
  { key: 'revenue', header: 'Room revenue', align: 'right', render: (t) => formatCurrency(t.roomRevenue), csv: (t) => t.roomRevenue },
  { key: 'adr', header: 'ADR', align: 'right', render: (t) => formatCurrency(t.averageDailyRate), csv: (t) => t.averageDailyRate, hideOnMobile: true },
  { key: 'revpar', header: 'RevPAR', align: 'right', render: (t) => formatCurrency(t.revPar), csv: (t) => t.revPar, hideOnMobile: true },
]

const roomColumns: ReportColumn<RoomPerformance>[] = [
  {
    key: 'room',
    header: 'Room',
    render: (r) => (
      <Link to={`/rooms/${r.roomId}`} className="font-medium text-brand-700 hover:underline">
        {r.roomNumber}
      </Link>
    ),
    csv: (r) => r.roomNumber,
  },
  { key: 'type', header: 'Type', render: (r) => enumLabel(r.type), csv: (r) => enumLabel(r.type) },
  { key: 'floor', header: 'Floor', align: 'right', render: (r) => r.floor, csv: (r) => r.floor, hideOnMobile: true },
  { key: 'stays', header: 'Stays', align: 'right', render: (r) => r.stays, csv: (r) => r.stays, hideOnMobile: true },
  { key: 'nights', header: 'Nights sold', align: 'right', render: (r) => r.nightsSold, csv: (r) => r.nightsSold },
  { key: 'occupancy', header: 'Occupancy %', align: 'right', render: (r) => formatPercent(r.occupancyRate), csv: (r) => r.occupancyRate },
  { key: 'revenue', header: 'Room revenue', align: 'right', render: (r) => formatCurrency(r.roomRevenue), csv: (r) => r.roomRevenue, hideOnMobile: true },
  { key: 'adr', header: 'ADR', align: 'right', render: (r) => formatCurrency(r.averageDailyRate), csv: (r) => r.averageDailyRate, hideOnMobile: true },
]

function OccupancyContent({ report }: { report: OccupancyReport }) {
  const { totals } = report
  return (
    <>
      <StatGrid>
        <StatCard
          label="Occupancy"
          value={formatPercent(totals.occupancyRate)}
          icon={Percent}
          meter={totals.occupancyRate}
          hint={`${formatNumber(totals.roomNightsSold)} of ${formatNumber(totals.roomNightsAvailable)} room nights sold`}
        />
        <StatCard label="Room revenue" value={whole(totals.roomRevenue)} icon={IndianRupee} hint="Nightly rates of the nights sold" />
        <StatCard label="Average daily rate" value={whole(totals.averageDailyRate)} icon={BedDouble} hint="Room revenue ÷ room nights sold" />
        <StatCard label="RevPAR" value={whole(totals.revPar)} icon={TrendingUp} hint="Room revenue ÷ room nights available" />
      </StatGrid>

      {totals.forecastFrom && (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          Nights from <span className="font-medium text-ink">{formatDate(totals.forecastFrom)}</span> are on the books: they count confirmed and pending
          bookings, which can still change. Earlier nights count only stays that happened.
        </p>
      )}

      <OccupancyReportChart nights={report.nights} />

      <ReportTable
        title="Performance by room type"
        subtitle="Room revenue is the nightly rate of each night sold, before discounts and tax"
        range={report}
        rows={report.byRoomType}
        columns={typeColumns}
        rowKey={(t) => t.type}
      />

      <ReportTable
        title="Room performance"
        subtitle="Every room, most nights sold first"
        range={report}
        rows={report.rooms}
        columns={roomColumns}
        rowKey={(r) => r.roomId}
        scroll
      />
    </>
  )
}
