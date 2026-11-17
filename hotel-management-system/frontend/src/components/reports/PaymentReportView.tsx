import { Clock, IndianRupee, Receipt, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { usePaymentReport } from '@/hooks/useReports'
import type { PaymentRecord } from '@/types/billing'
import type { PaymentReport, PaymentStatusRow, ReportRange } from '@/types/reports'
import { enumLabel, formatCurrency, formatCurrencyCompact, formatDateTime, formatNumber } from '@/utils/format'
import { RankedBarChart } from './RankedBarChart'
import { ReportQuery, StatGrid } from './ReportLayout'
import { ReportTable, type ReportColumn } from './ReportTable'

const whole = (amount: number) => formatCurrency(amount, { whole: true })

export function PaymentReportView({ range }: { range: ReportRange }) {
  const report = usePaymentReport(range)
  return <ReportQuery query={report}>{(data) => <PaymentContent report={data} />}</ReportQuery>
}

const statusColumns: ReportColumn<PaymentStatusRow>[] = [
  { key: 'status', header: 'Status', render: (s) => <StatusBadge kind="payment" status={s.key} />, csv: (s) => enumLabel(s.key) },
  { key: 'count', header: 'Transactions', align: 'right', render: (s) => s.count, csv: (s) => s.count },
  { key: 'amount', header: 'Amount', align: 'right', render: (s) => formatCurrency(s.amount), csv: (s) => s.amount },
]

const paymentColumns: ReportColumn<PaymentRecord>[] = [
  { key: 'date', header: 'Date', render: (p) => formatDateTime(p.paymentDate), csv: (p) => p.paymentDate.replace('T', ' ') },
  { key: 'id', header: 'Payment', csv: (p) => p.id, exportOnly: true },
  { key: 'guest', header: 'Guest', render: (p) => p.guestName, csv: (p) => p.guestName },
  {
    key: 'invoice',
    header: 'Invoice',
    render: (p) => (
      <Link to={`/billing/invoices/${p.reservationId}`} className="text-brand-700 hover:underline">
        {p.invoiceNumber}
      </Link>
    ),
    csv: (p) => p.invoiceNumber,
    hideOnMobile: true,
  },
  { key: 'method', header: 'Method', render: (p) => enumLabel(p.method), csv: (p) => enumLabel(p.method), hideOnMobile: true },
  { key: 'status', header: 'Status', render: (p) => <StatusBadge kind="payment" status={p.status} />, csv: (p) => enumLabel(p.status) },
  { key: 'reference', header: 'Reference', render: (p) => <span className="font-mono text-xs">{p.transactionReference}</span>, csv: (p) => p.transactionReference, hideOnMobile: true },
  { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-medium tabular-nums">{formatCurrency(p.amount)}</span>, csv: (p) => p.amount },
]

function PaymentContent({ report }: { report: PaymentReport }) {
  const { totals } = report
  return (
    <>
      <StatGrid>
        <StatCard label="Net collected" value={whole(totals.net)} icon={IndianRupee} hint={`${whole(totals.collected)} in · ${whole(totals.refunded)} refunded`} />
        <StatCard label="Transactions" value={formatNumber(totals.transactions)} icon={Receipt} hint="Payments and refunds, any status" />
        <StatCard label="Pending" value={whole(totals.pendingAmount)} icon={Clock} hint={`${totals.pendingCount} awaiting confirmation`} />
        <StatCard label="Failed" value={whole(totals.failedAmount)} icon={XCircle} hint={`${totals.failedCount} declined or not received`} />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankedBarChart
          title="Net collected by method"
          subtitle="Completed payments less refunds"
          data={report.byMethod.map((m) => ({ key: m.key, label: enumLabel(m.key), value: m.net }))}
          valueLabel="Net collected"
          format={whole}
          labelFormat={formatCurrencyCompact}
        />
        <ReportTable title="Payments by status" range={report} rows={report.byStatus} columns={statusColumns} rowKey={(s) => s.key} />
      </div>

      <ReportTable
        title="Transactions"
        subtitle="Every payment and refund in this range, newest first. Refunds are negative."
        range={report}
        rows={report.rows}
        columns={paymentColumns}
        rowKey={(p) => p.id}
        emptyTitle="No payments in this date range"
        scroll
      />
    </>
  )
}
