import { CalendarDays, IndianRupee, RotateCcw, Wallet } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/common/Card'
import { StatCard } from '@/components/common/StatCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { useRevenueReport } from '@/hooks/useReports'
import type { ChargesBreakdown, ReportGrouping, RevenuePeriod, RevenueReport, RevenueReportQuery } from '@/types/reports'
import { enumLabel, formatCurrency, formatCurrencyCompact, formatDate, formatMonth, formatNumber, formatShortDate } from '@/utils/format'
import { RankedBarChart } from './RankedBarChart'
import { ReportQuery, StatGrid } from './ReportLayout'
import { ReportTable, type ReportColumn } from './ReportTable'

const UNIT: Record<ReportGrouping, string> = { DAY: 'day', MONTH: 'month', YEAR: 'year' }
const whole = (amount: number) => formatCurrency(amount, { whole: true })

export function RevenueReportView({ query }: { query: RevenueReportQuery }) {
  const report = useRevenueReport(query)
  return <ReportQuery query={report}>{(data) => <RevenueContent report={data} />}</ReportQuery>
}

function RevenueContent({ report }: { report: RevenueReport }) {
  const { groupBy, totals } = report
  const multiYear = report.from.slice(0, 4) !== report.to.slice(0, 4)
  const fullLabel = (p: string) => (groupBy === 'DAY' ? formatDate(p) : groupBy === 'MONTH' ? formatMonth(p, { withYear: true }) : p)
  const axisLabel = (p: string) => (groupBy === 'DAY' ? formatShortDate(p) : groupBy === 'MONTH' ? formatMonth(p, { withYear: multiYear }) : p)
  const days = report.periods.length && groupBy === 'DAY' ? report.periods.length : undefined

  const columns: ReportColumn<RevenuePeriod>[] = [
    { key: 'period', header: groupBy === 'DAY' ? 'Date' : groupBy === 'MONTH' ? 'Month' : 'Year', render: (p) => fullLabel(p.period), csv: (p) => p.period },
    { key: 'transactions', header: 'Transactions', align: 'right', render: (p) => formatNumber(p.transactions), csv: (p) => p.transactions },
    { key: 'collected', header: 'Collected', align: 'right', render: (p) => formatCurrency(p.collected), csv: (p) => p.collected },
    { key: 'refunded', header: 'Refunds', align: 'right', render: (p) => formatCurrency(p.refunded), csv: (p) => p.refunded, hideOnMobile: true },
    { key: 'net', header: 'Net revenue', align: 'right', render: (p) => <span className="font-medium">{formatCurrency(p.net)}</span>, csv: (p) => p.net },
  ]

  return (
    <>
      <StatGrid>
        <StatCard label="Net revenue" value={whole(totals.net)} icon={IndianRupee} hint={`${formatNumber(totals.transactions)} completed transactions`} />
        <StatCard label="Collected" value={whole(totals.collected)} icon={Wallet} hint="Payments received" />
        <StatCard label="Refunds" value={whole(totals.refunded)} icon={RotateCcw} hint="Returned to guests" />
        <StatCard
          label="Average per day"
          value={whole(totals.averagePerDay)}
          icon={CalendarDays}
          hint={days ? `Across ${days} days` : 'Net revenue ÷ days in range'}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <RevenueChart
            title={`Net revenue by ${UNIT[groupBy]}`}
            subtitle="Completed payments less refunds, by payment date"
            points={report.periods.map((p) => ({ period: p.period, amount: p.net }))}
            axisLabel={axisLabel}
            fullLabel={fullLabel}
          />
        </div>
        <ChargesCard charges={report.charges} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankedBarChart
          title="Revenue by booking source"
          subtitle="Net payments, by the booking's channel"
          data={report.bySource.map((s) => ({ key: s.key, label: enumLabel(s.key), value: s.net }))}
          valueLabel="Net revenue"
          format={whole}
          labelFormat={formatCurrencyCompact}
        />
        <RankedBarChart
          title="Revenue by room type"
          subtitle="Net payments, by the booked room's type"
          data={report.byRoomType.map((s) => ({ key: s.key, label: enumLabel(s.key), value: s.net }))}
          valueLabel="Net revenue"
          format={whole}
          labelFormat={formatCurrencyCompact}
        />
      </div>

      <ReportTable
        title="Revenue by period"
        subtitle={`One row per ${UNIT[groupBy]}; the first and last can be partial`}
        range={report}
        rows={report.periods}
        columns={columns}
        rowKey={(p) => p.period}
        scroll
      />
    </>
  )
}

/** Accrual view: what departing stays were billed, whether or not it has been paid. */
function ChargesCard({ charges }: { charges: ChargesBreakdown }) {
  const lines: Array<[string, number]> = [
    ['Room charges', charges.roomCharges],
    // A zero discount must not render as -₹0.00.
    ['Discounts', charges.discounts ? -charges.discounts : 0],
    ['Restaurant & room service', charges.foodCharges],
    ['Extra charges', charges.extraCharges],
    ['GST', charges.tax],
  ]
  return (
    <Card>
      <CardHeader title="Billed on departure" subtitle={`Folios of ${charges.stays} stay${charges.stays === 1 ? '' : 's'} that checked out in this range`} />
      <CardBody>
        <dl className="divide-y divide-line text-sm">
          {lines.map(([label, amount]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-ink tabular-nums">{formatCurrency(amount)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 pt-3 font-semibold">
            <dt className="text-ink">Total billed</dt>
            <dd className="text-ink tabular-nums">{formatCurrency(charges.total)}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  )
}
