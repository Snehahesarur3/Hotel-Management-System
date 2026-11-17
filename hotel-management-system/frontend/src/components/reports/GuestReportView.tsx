import { IndianRupee, Repeat, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/common/Badge'
import { StatCard } from '@/components/common/StatCard'
import { useGuestReport } from '@/hooks/useReports'
import type { GuestReport, GuestReportRow, NationalityRow, ReportRange } from '@/types/reports'
import { formatCurrency, formatDate, formatNumber } from '@/utils/format'
import { RankedBarChart } from './RankedBarChart'
import { ReportQuery, StatGrid } from './ReportLayout'
import { ReportTable, type ReportColumn } from './ReportTable'

export function GuestReportView({ range }: { range: ReportRange }) {
  const report = useGuestReport(range)
  return <ReportQuery query={report}>{(data) => <GuestContent report={data} />}</ReportQuery>
}

const nationalityColumns: ReportColumn<NationalityRow>[] = [
  { key: 'nationality', header: 'Nationality', render: (n) => n.key, csv: (n) => n.key },
  { key: 'guests', header: 'Guests', align: 'right', render: (n) => n.guests, csv: (n) => n.guests },
  { key: 'stays', header: 'Stays', align: 'right', render: (n) => n.stays, csv: (n) => n.stays, hideOnMobile: true },
  { key: 'nights', header: 'Nights', align: 'right', render: (n) => n.nights, csv: (n) => n.nights, hideOnMobile: true },
  { key: 'revenue', header: 'Room revenue', align: 'right', render: (n) => formatCurrency(n.roomRevenue), csv: (n) => n.roomRevenue },
]

const guestColumns: ReportColumn<GuestReportRow>[] = [
  {
    key: 'guest',
    header: 'Guest',
    render: (g) => (
      <span className="flex flex-wrap items-center gap-2">
        <Link to={`/guests/${g.guestId}`} className="font-medium text-brand-700 hover:underline">
          {g.guestName}
        </Link>
        {g.isNew && <Badge tone="brand">New</Badge>}
        {g.isReturning && <Badge tone="success">Returning</Badge>}
      </span>
    ),
    csv: (g) => g.guestName,
  },
  { key: 'nationality', header: 'Nationality', render: (g) => g.nationality, csv: (g) => g.nationality, hideOnMobile: true },
  { key: 'stays', header: 'Stays', align: 'right', render: (g) => g.stays, csv: (g) => g.stays, hideOnMobile: true },
  { key: 'nights', header: 'Nights', align: 'right', render: (g) => g.nights, csv: (g) => g.nights },
  { key: 'revenue', header: 'Room revenue', align: 'right', render: (g) => formatCurrency(g.roomRevenue), csv: (g) => g.roomRevenue },
  { key: 'last', header: 'Last arrival', render: (g) => formatDate(g.lastArrival), csv: (g) => g.lastArrival, hideOnMobile: true },
  { key: 'new', header: 'New guest', csv: (g) => (g.isNew ? 'Yes' : 'No'), exportOnly: true },
  { key: 'returning', header: 'Returning guest', csv: (g) => (g.isReturning ? 'Yes' : 'No'), exportOnly: true },
]

function GuestContent({ report }: { report: GuestReport }) {
  const { totals } = report
  return (
    <>
      <StatGrid>
        <StatCard label="Guests" value={formatNumber(totals.guests)} icon={Users} hint={`${formatNumber(totals.stays)} stays arriving in this range`} />
        <StatCard label="New guests" value={formatNumber(totals.newGuests)} icon={UserPlus} hint="Registered in this range" />
        <StatCard label="Returning guests" value={formatNumber(totals.returningGuests)} icon={Repeat} hint="Stayed with us before this range" />
        <StatCard
          label="Room revenue per guest"
          value={formatCurrency(totals.averageRevenuePerGuest, { whole: true })}
          icon={IndianRupee}
          hint={`${formatCurrency(totals.roomRevenue, { whole: true })} in total`}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankedBarChart
          title="Guests by nationality"
          data={report.byNationality.map((n) => ({ key: n.key, label: n.key, value: n.guests }))}
          valueLabel="Guests"
          format={formatNumber}
        />
        <ReportTable title="Nationalities" range={report} rows={report.byNationality} columns={nationalityColumns} rowKey={(n) => n.key} />
      </div>

      <ReportTable
        title="Guest stays"
        subtitle="Guests with a stay arriving in this range, highest room revenue first (cancellations excluded)"
        range={report}
        rows={report.guests}
        columns={guestColumns}
        rowKey={(g) => g.guestId}
        emptyTitle="No guest stays in this date range"
        scroll
      />
    </>
  )
}
