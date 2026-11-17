import { ArrowLeft, BadgePercent, Plus, Printer, RotateCcw, SearchX, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdjustmentDialog } from '@/components/billing/AdjustmentDialog'
import { BalanceBadge, InvoiceStateBadge } from '@/components/billing/BillingBadges'
import { RecordPaymentDialog, RefundDialog } from '@/components/billing/MoneyDialogs'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useInvoice, useRemoveAdjustment } from '@/hooks/useBilling'
import { ApiError } from '@/types/api'
import { cn } from '@/utils/cn'
import { enumLabel, formatCurrency, formatDate, formatDateTime } from '@/utils/format'

const STATE_NOTE = {
  ESTIMATE: 'Estimate for an upcoming stay, at the booked dates and rate.',
  INTERIM: 'Interim invoice for a stay in progress. The final invoice is issued at check-out.',
  FINAL: 'Final invoice. Charges are locked.',
  VOID: 'Booking cancelled: no charges. Any payment received is refundable.',
} as const

const cgst = (tax: number) => Math.round((tax / 2) * 100) / 100

export function InvoicePage() {
  const can = useCan()
  const { reservationId = '' } = useParams()
  const invoice = useInvoice(reservationId)
  const remove = useRemoveAdjustment()
  const [adjusting, setAdjusting] = useState<'EXTRA' | 'DISCOUNT' | null>(null)
  const [paying, setPaying] = useState(false)
  const [refunding, setRefunding] = useState(false)

  const backLink = (
    <Link to="/billing" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink print:hidden">
      <ArrowLeft className="size-4" aria-hidden /> Billing & Payments
    </Link>
  )

  if (invoice.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading invoice">
        {backLink}
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
      </div>
    )
  }
  if (invoice.isError) {
    const notFound = invoice.error instanceof ApiError && invoice.error.status === 404
    return (
      <div className="space-y-6">
        {backLink}
        <Card>
          {notFound ? (
            <EmptyState icon={SearchX} title="Invoice not found" description="Check the booking or invoice number." className="py-16" />
          ) : (
            <ErrorState message={invoice.error.message} onRetry={() => void invoice.refetch()} retrying={invoice.isFetching} />
          )}
        </Card>
      </div>
    )
  }

  const inv = invoice.data
  const { bill } = inv
  const canPay = inv.state !== 'VOID' && inv.balance > 0 && can('billing.manage')
  const canRefund = inv.balance < 0 && can('billing.supervise')
  const canRemoveAdjustments = inv.editable && can('billing.supervise')
  return (
    <div className="space-y-6">
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Invoice {inv.invoiceNumber}</h1>
            <InvoiceStateBadge state={inv.state} />
            <BalanceBadge state={inv.balanceState} />
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">{STATE_NOTE[inv.state]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inv.editable && can('billing.manage') && (
            <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdjusting('EXTRA')}>
              Add charge
            </Button>
          )}
          {inv.editable && can('billing.supervise') && (
            <Button variant="secondary" icon={<BadgePercent className="size-4" aria-hidden />} onClick={() => setAdjusting('DISCOUNT')}>
              Add discount
            </Button>
          )}
          {canPay && (
            <Button icon={<Wallet className="size-4" aria-hidden />} onClick={() => setPaying(true)}>
              Record payment
            </Button>
          )}
          {canRefund && (
            <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setRefunding(true)}>
              Refund {formatCurrency(-inv.balance)}
            </Button>
          )}
          <Button variant="secondary" icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* The invoice document: the only thing that prints. */}
      <Card className="mx-auto max-w-4xl print:max-w-none print:border-0 print:shadow-none">
        <article aria-label={`Invoice ${inv.invoiceNumber}`} className="space-y-8 p-4 sm:p-8 print:p-0">
          <header className="flex flex-wrap justify-between gap-6">
            <div>
              <p className="text-lg font-semibold text-ink">{inv.hotel.name}</p>
              <p className="mt-1 max-w-xs text-sm text-ink-muted">{inv.hotel.address}</p>
              <p className="text-sm text-ink-muted">
                {inv.hotel.phone} · {inv.hotel.email}
              </p>
              <p className="mt-1 text-sm text-ink-muted">GSTIN {inv.hotel.gstin}</p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="text-base font-semibold text-ink">
                {inv.state === 'FINAL' ? 'Tax invoice' : inv.state === 'VOID' ? 'Void invoice' : inv.state === 'INTERIM' ? 'Interim invoice' : 'Estimate'}
              </p>
              <p className="mt-1 text-ink-muted">
                No. <span className="font-medium text-ink">{inv.invoiceNumber}</span>
              </p>
              <p className="text-ink-muted">Date {formatDate(inv.issuedOn)}</p>
              <p className="text-ink-muted">
                Booking{' '}
                <Link to={`/reservations/${inv.reservationId}`} className="font-medium text-brand-700 hover:underline print:text-ink">
                  {inv.reservationId}
                </Link>
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Billed to</p>
              <p className="mt-1 font-medium text-ink">
                <Link to={`/guests/${inv.guest.id}`} className="hover:underline">
                  {inv.guest.fullName}
                </Link>
              </p>
              <p className="text-ink-muted">{inv.guest.address}</p>
              <p className="text-ink-muted">
                {inv.guest.email} · {inv.guest.phone}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Stay</p>
              <p className="mt-1 text-ink">
                Room {bill.roomNumber} · {enumLabel(inv.roomType)}
              </p>
              <p className="text-ink-muted">
                {formatDate(bill.checkIn)} – {formatDate(bill.checkOut)}
                {bill.nights > 0 && ` · ${bill.nights} night${bill.nights > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <caption className="sr-only">Charges</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th scope="col" className="py-2 font-medium">
                  Description
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Amount
                </th>
                {canRemoveAdjustments && (
                  <th scope="col" className="w-10 py-2 print:hidden">
                    <span className="sr-only">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bill.lines.length === 0 ? (
                <tr>
                  <td colSpan={canRemoveAdjustments ? 3 : 2} className="py-3 text-ink-muted">
                    No charges.
                  </td>
                </tr>
              ) : (
                bill.lines.map((line, index) => (
                  <tr key={`${line.kind}-${line.adjustmentId ?? index}`}>
                    <td className={cn('py-2.5', line.kind.endsWith('GST') ? 'pl-4 text-ink-muted' : 'text-ink')}>{line.description}</td>
                    <td className={cn('py-2.5 text-right tabular-nums', line.amount < 0 ? 'text-success' : 'text-ink')}>
                      {line.amount < 0 ? `− ${formatCurrency(-line.amount)}` : formatCurrency(line.amount)}
                    </td>
                    {canRemoveAdjustments && (
                      <td className="py-1.5 text-right print:hidden">
                        {line.adjustmentId && (
                          <button
                            type="button"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate({ reservationId: inv.reservationId, adjustmentId: line.adjustmentId!, description: line.description })}
                            className="grid size-7 place-items-center rounded-md text-ink-subtle hover:bg-canvas hover:text-danger focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50"
                            aria-label={`Remove ${line.description}`}
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="text-sm">
              <tr className="border-t-2 border-ink/80 font-semibold">
                <th scope="row" className="py-2.5 text-left text-ink">
                  Total
                </th>
                <td className="py-2.5 text-right text-ink tabular-nums">{formatCurrency(bill.total)}</td>
                {canRemoveAdjustments && <td className="print:hidden" />}
              </tr>
              <tr>
                <th scope="row" className="py-1.5 text-left font-normal text-ink-muted">
                  Paid (net of refunds)
                </th>
                <td className="py-1.5 text-right tabular-nums">− {formatCurrency(bill.paid)}</td>
                {canRemoveAdjustments && <td className="print:hidden" />}
              </tr>
              <tr className="font-semibold">
                <th scope="row" className="py-1.5 text-left text-ink">
                  {inv.balance >= 0 ? 'Balance due' : 'In credit (refundable)'}
                </th>
                <td className="py-1.5 text-right text-ink tabular-nums">{formatCurrency(Math.abs(inv.balance))}</td>
                {canRemoveAdjustments && <td className="print:hidden" />}
              </tr>
            </tfoot>
          </table>

          {bill.taxSummary.length > 0 && (
            // Narrow screens scroll the table inside the invoice instead of widening the page.
            <div className="relative overflow-x-auto">
              <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">GST summary</h2>
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">GST summary</caption>
                <thead>
                  <tr className="border-b border-line text-xs text-ink-muted">
                    <th scope="col" className="py-1.5 text-left font-medium">
                      Rate
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Taxable value
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      CGST
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      SGST
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Total GST
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {bill.taxSummary.map((row) => (
                    <tr key={row.percent}>
                      <td className="py-1.5">{row.percent}%</td>
                      <td className="py-1.5 text-right">{formatCurrency(row.taxable)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(cgst(row.tax))}</td>
                      <td className="py-1.5 text-right">{formatCurrency(Math.round((row.tax - cgst(row.tax)) * 100) / 100)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(row.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="relative overflow-x-auto">
            <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Payments</h2>
            {bill.payments.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No payments recorded.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">Payments</caption>
                <thead>
                  <tr className="border-b border-line text-xs text-ink-muted">
                    <th scope="col" className="py-1.5 text-left font-medium">
                      Date
                    </th>
                    <th scope="col" className="py-1.5 text-left font-medium">
                      Method · reference
                    </th>
                    <th scope="col" className="py-1.5 text-left font-medium print:hidden">
                      Status
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {bill.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5 whitespace-nowrap">{formatDateTime(p.paymentDate)}</td>
                      <td className="py-1.5 text-ink-muted">
                        {p.amount < 0 ? 'Refund · ' : ''}
                        {enumLabel(p.method)} · <span className="font-mono text-xs">{p.transactionReference}</span>
                      </td>
                      <td className="py-1.5 print:hidden">
                        <StatusBadge kind="payment" status={p.status} />
                      </td>
                      <td className={cn('py-1.5 text-right tabular-nums', p.status === 'PENDING' && 'text-ink-muted', (p.status === 'FAILED' || p.status === 'REFUNDED') && 'text-ink-subtle line-through')}>
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <footer className="border-t border-line pt-4 text-xs text-ink-subtle">
            Computer-generated invoice for demonstration. Payments shown were processed by a mock gateway; no real transactions took place.
          </footer>
        </article>
      </Card>

      <AdjustmentDialog
        kind={adjusting}
        reservationId={inv.reservationId}
        invoiceNumber={inv.invoiceNumber}
        roomCharges={bill.roomCharges}
        discount={bill.discount}
        onClose={() => setAdjusting(null)}
      />
      <RecordPaymentDialog
        target={paying ? { reservationId: inv.reservationId, invoiceNumber: inv.invoiceNumber, balance: inv.balance } : null}
        onClose={() => setPaying(false)}
      />
      <RefundDialog
        target={refunding ? { reservationId: inv.reservationId, invoiceNumber: inv.invoiceNumber, credit: -inv.balance } : null}
        onClose={() => setRefunding(false)}
      />
    </div>
  )
}
