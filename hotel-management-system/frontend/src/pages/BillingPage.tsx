import { CircleDollarSign, Clock, FileText, Receipt, RotateCcw, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BalanceBadge, InvoiceStateBadge } from '@/components/billing/BillingBadges'
import { RecordPaymentDialog, RefundDialog } from '@/components/billing/MoneyDialogs'
import { useCan } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TextInput } from '@/components/common/FormControls'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { StatCard } from '@/components/common/StatCard'
import { ErrorState, LoadingState, Skeleton } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Tabs } from '@/components/common/Tabs'
import { useBillingSummary, useInvoiceList, usePaymentList, useUpdatePaymentStatus } from '@/hooks/useBilling'
import { useListParams } from '@/hooks/useListParams'
import type { PageResponse } from '@/types/api'
import type {
  BalanceState,
  InvoiceListQuery,
  InvoiceSortField,
  InvoiceState,
  InvoiceSummary,
  PaymentListQuery,
  PaymentRecord,
  PaymentSortField,
} from '@/types/billing'
import { PAYMENT_METHODS, PAYMENT_STATUSES, type PaymentMethod, type PaymentStatus } from '@/types/enums'
import { cn } from '@/utils/cn'
import { enumLabel, formatCurrency, formatDateTime, formatShortDate } from '@/utils/format'

const TABS = [
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'payments', label: 'Payments', icon: Receipt },
] as const
type TabKey = (typeof TABS)[number]['key']
const PAGE_SIZE = 15
const ISO = /^\d{4}-\d{2}-\d{2}$/
const oneOf = <T extends string>(values: readonly T[], value: string | undefined) =>
  value && (values as readonly string[]).includes(value) ? (value as T) : undefined

/** Moves back to the last page when filtering shrinks the result below the current page. */
function useClampPage(data: PageResponse<unknown> | undefined, isPlaceholder: boolean, page: number, setPage: (p: number) => void) {
  const lastPage = data && data.totalPages > 0 ? data.totalPages - 1 : 0
  const outOfRange = Boolean(data && !isPlaceholder && page > lastPage)
  useEffect(() => {
    if (outOfRange) setPage(lastPage)
  }, [outOfRange, lastPage, setPage])
}

export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: TabKey = searchParams.get('tab') === 'payments' ? 'payments' : 'invoices'
  const summary = useBillingSummary()
  const s = summary.data

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Payments" description="Invoices, payments, outstanding balances and refunds." />

      {summary.isError ? (
        <Card>
          <ErrorState message={summary.error.message} onRetry={() => void summary.refetch()} retrying={summary.isFetching} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {s ? (
            <>
              <StatCard
                label="Outstanding"
                value={formatCurrency(s.outstandingTotal, { whole: true })}
                icon={CircleDollarSign}
                hint={`${s.outstandingCount} stay${s.outstandingCount === 1 ? '' : 's'} with a balance due`}
              />
              <StatCard label="Collected this month" value={formatCurrency(s.collectedThisMonth, { whole: true })} icon={Wallet} hint="Completed payments, net of refunds" />
              <StatCard
                label="Refunds due"
                value={formatCurrency(s.creditTotal, { whole: true })}
                icon={RotateCcw}
                hint={`${s.creditCount} folio${s.creditCount === 1 ? '' : 's'} in credit`}
              />
              <StatCard
                label="Pending payments"
                value={formatCurrency(s.pendingTotal, { whole: true })}
                icon={Clock}
                hint={`${s.pendingCount} awaiting confirmation`}
              />
            </>
          ) : (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-[var(--radius-card)]" />)
          )}
        </div>
      )}

      <Card>
        <Tabs
          label="Billing lists"
          idPrefix="billing"
          tabs={TABS}
          value={tab}
          // Each list keeps its own filters; switching tabs starts from a clean view.
          onChange={(key) => setSearchParams(key === 'invoices' ? {} : { tab: key })}
        >
          {tab === 'invoices' ? <InvoicesTab /> : <PaymentsTab />}
        </Tabs>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ invoices

const INVOICE_FILTERS = ['balance', 'state'] as const
const INVOICE_SORTS: readonly InvoiceSortField[] = ['invoiceNumber', 'guestName', 'checkIn', 'checkOut', 'total', 'balance']
const INVOICE_STATES: readonly InvoiceState[] = ['ESTIMATE', 'INTERIM', 'FINAL', 'VOID']
const BALANCE_STATES: readonly BalanceState[] = ['DUE', 'SETTLED', 'CREDIT']

function InvoicesTab() {
  const can = useCan()
  const canManage = can('billing.manage')
  const canSupervise = can('billing.supervise')
  const { params, update, clear } = useListParams(INVOICE_FILTERS, INVOICE_SORTS)
  const query: InvoiceListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    balance: oneOf(BALANCE_STATES, params.filters.balance),
    state: oneOf(INVOICE_STATES, params.filters.state),
  }
  const invoices = useInvoiceList(query)
  const [paying, setPaying] = useState<InvoiceSummary | null>(null)
  const [refunding, setRefunding] = useState<InvoiceSummary | null>(null)
  const filtersActive = Boolean(query.search || query.balance || query.state)
  useClampPage(invoices.data, invoices.isPlaceholderData, params.page, (page) => update({ page }))

  const columns: Column<InvoiceSummary>[] = [
    {
      key: 'number',
      header: 'Invoice',
      sortField: 'invoiceNumber',
      render: (i) => (
        <div>
          <Link to={`/billing/invoices/${i.reservationId}`} className="font-medium text-brand-700 hover:underline">
            {i.invoiceNumber}
          </Link>
          <div className="mt-0.5">
            <InvoiceStateBadge state={i.state} />
          </div>
        </div>
      ),
    },
    {
      key: 'guest',
      header: 'Guest',
      sortField: 'guestName',
      render: (i) => (
        <div>
          <Link to={`/guests/${i.guestId}`} className="text-ink hover:text-brand-700 hover:underline">
            {i.guestName}
          </Link>
          <p className="text-xs text-ink-muted">Room {i.roomNumber}</p>
        </div>
      ),
    },
    {
      key: 'stay',
      header: 'Stay',
      sortField: 'checkIn',
      hideOnMobile: true,
      render: (i) => `${formatShortDate(i.checkIn)} – ${formatShortDate(i.checkOut)}`,
    },
    { key: 'total', header: 'Total', sortField: 'total', align: 'right', hideOnMobile: true, render: (i) => formatCurrency(i.total) },
    { key: 'paid', header: 'Paid', align: 'right', hideOnMobile: true, render: (i) => formatCurrency(i.paid) },
    {
      key: 'balance',
      header: 'Balance',
      sortField: 'balance',
      align: 'right',
      render: (i) => (
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-medium tabular-nums">{formatCurrency(Math.abs(i.balance))}</span>
          <BalanceBadge state={i.balanceState} />
        </div>
      ),
    },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      hidden: !canManage && !canSupervise,
      render: (i) =>
        i.balance > 0 && i.state !== 'VOID' && canManage ? (
          <Button size="sm" variant="secondary" onClick={() => setPaying(i)} aria-label={`Record payment for ${i.invoiceNumber}`}>
            Record payment
          </Button>
        ) : i.balance < 0 && canSupervise ? (
          <Button size="sm" variant="secondary" onClick={() => setRefunding(i)} aria-label={`Refund ${i.invoiceNumber}`}>
            Refund
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput label="Search invoices" placeholder="Invoice, booking, guest or room…" value={params.search} onSearch={(search) => update({ search })} className="sm:w-72" />
        <FilterSelect
          label="Filter by balance"
          allLabel="All balances"
          value={query.balance ?? ''}
          options={[
            { value: 'DUE', label: 'Balance due' },
            { value: 'SETTLED', label: 'Settled' },
            { value: 'CREDIT', label: 'In credit' },
          ]}
          onChange={(value) => update({ filters: { balance: value } })}
        />
        <FilterSelect
          label="Filter by invoice state"
          allLabel="All invoices"
          value={query.state ?? ''}
          options={INVOICE_STATES.map((v) => ({ value: v, label: enumLabel(v) }))}
          onChange={(value) => update({ filters: { state: value } })}
        />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => clear()} className="sm:ml-auto">
            Clear filters
          </Button>
        )}
      </div>
      {invoices.isPending ? (
        <div className="px-5 pb-5">
          <LoadingState label="Loading invoices" rows={8} />
        </div>
      ) : invoices.isError ? (
        <ErrorState message={invoices.error.message} onRetry={() => void invoices.refetch()} retrying={invoices.isFetching} />
      ) : (
        <>
          <DataTable
            caption="Invoices"
            columns={columns}
            rows={invoices.data.content}
            rowKey={(i) => i.reservationId}
            sort={params.sort}
            onSortChange={(sort) => update({ sort: sort as InvoiceListQuery['sort'] | null })}
            busy={invoices.isPlaceholderData}
            emptyTitle={filtersActive ? 'No invoices match your filters' : 'No invoices yet'}
            emptyDescription={filtersActive ? 'Try a different search or filter.' : 'Invoices appear once a guest checks in or pays a deposit.'}
          />
          <Pagination
            className="border-t border-line"
            page={invoices.data.page}
            size={invoices.data.size}
            totalElements={invoices.data.totalElements}
            totalPages={invoices.data.totalPages}
            onPageChange={(page) => update({ page })}
          />
        </>
      )}
      <RecordPaymentDialog target={paying && { reservationId: paying.reservationId, invoiceNumber: paying.invoiceNumber, balance: paying.balance }} onClose={() => setPaying(null)} />
      <RefundDialog
        target={refunding && { reservationId: refunding.reservationId, invoiceNumber: refunding.invoiceNumber, credit: -refunding.balance }}
        onClose={() => setRefunding(null)}
      />
    </>
  )
}

// ------------------------------------------------------------------ payments

const PAYMENT_FILTERS = ['status', 'method', 'from', 'to'] as const
const PAYMENT_SORTS: readonly PaymentSortField[] = ['paymentDate', 'amount', 'guestName', 'method', 'status']

function PaymentsTab() {
  const canManage = useCan()('billing.manage')
  const { params, update } = useListParams(PAYMENT_FILTERS, PAYMENT_SORTS)
  // Like useListParams.clear, but keeps ?tab=payments.
  const clear = () => update({ search: '', sort: null, filters: { status: '', method: '', from: '', to: '' } })
  const { from, to } = params.filters
  const query: PaymentListQuery = {
    page: params.page,
    size: PAGE_SIZE,
    search: params.search || undefined,
    sort: params.sort,
    status: oneOf<PaymentStatus>(PAYMENT_STATUSES, params.filters.status),
    method: oneOf<PaymentMethod>(PAYMENT_METHODS, params.filters.method),
    from: ISO.test(from ?? '') ? from : undefined,
    to: ISO.test(to ?? '') ? to : undefined,
  }
  const payments = usePaymentList(query)
  const [resolving, setResolving] = useState<{ payment: PaymentRecord; status: 'COMPLETED' | 'FAILED' } | null>(null)
  const updateStatus = useUpdatePaymentStatus({ onDone: () => setResolving(null) })
  const filtersActive = Boolean(query.search || query.status || query.method || query.from || query.to)
  useClampPage(payments.data, payments.isPlaceholderData, params.page, (page) => update({ page }))

  const columns: Column<PaymentRecord>[] = [
    {
      key: 'date',
      header: 'Date',
      sortField: 'paymentDate',
      render: (p) => (
        <div>
          <span className="whitespace-nowrap">{formatDateTime(p.paymentDate)}</span>
          <p className="text-xs text-ink-muted">{p.id}</p>
        </div>
      ),
    },
    {
      key: 'guest',
      header: 'Guest',
      sortField: 'guestName',
      render: (p) => (
        <div>
          <span>{p.guestName}</span>
          <p className="text-xs">
            <Link to={`/billing/invoices/${p.reservationId}`} className="text-brand-700 hover:underline">
              {p.invoiceNumber}
            </Link>
            <span className="text-ink-muted"> · Room {p.roomNumber}</span>
          </p>
        </div>
      ),
    },
    { key: 'method', header: 'Method', sortField: 'method', hideOnMobile: true, render: (p) => enumLabel(p.method) },
    { key: 'ref', header: 'Reference', hideOnMobile: true, render: (p) => <span className="font-mono text-xs text-ink-muted">{p.transactionReference}</span> },
    {
      key: 'amount',
      header: 'Amount',
      sortField: 'amount',
      align: 'right',
      render: (p) => (
        <span className={cn('font-medium tabular-nums', p.status === 'PENDING' && 'text-ink-muted', (p.status === 'FAILED' || p.status === 'REFUNDED') && 'text-ink-subtle line-through', p.amount < 0 && 'text-brand-700')}>
          {p.amount < 0 ? `Refund ${formatCurrency(-p.amount)}` : formatCurrency(p.amount)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortField: 'status', render: (p) => <StatusBadge kind="payment" status={p.status} /> },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      hidden: !canManage,
      render: (p) =>
        p.status === 'PENDING' ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="secondary" onClick={() => setResolving({ payment: p, status: 'COMPLETED' })} aria-label={`Confirm ${p.id} received`}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResolving({ payment: p, status: 'FAILED' })} aria-label={`Mark ${p.id} failed`}>
              Failed
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput label="Search payments" placeholder="Payment, invoice, guest or reference…" value={params.search} onSearch={(search) => update({ search })} className="lg:w-72" />
        <FilterSelect
          label="Filter by payment status"
          allLabel="All statuses"
          value={query.status ?? ''}
          options={PAYMENT_STATUSES.map((v) => ({ value: v, label: enumLabel(v) }))}
          onChange={(value) => update({ filters: { status: value } })}
          className="lg:w-40"
        />
        <FilterSelect
          label="Filter by method"
          allLabel="All methods"
          value={query.method ?? ''}
          options={PAYMENT_METHODS.map((v) => ({ value: v, label: enumLabel(v) }))}
          onChange={(value) => update({ filters: { method: value } })}
          className="lg:w-40"
        />
        <div className="flex min-w-0 items-center gap-2">
          <TextInput
            type="date"
            aria-label="Paid from"
            value={query.from ?? ''}
            max={query.to}
            onChange={(e) => update({ filters: { from: e.target.value } })}
            className="min-w-0 flex-1 lg:w-40 lg:flex-none"
          />
          <span className="text-sm text-ink-subtle" aria-hidden>
            to
          </span>
          <TextInput
            type="date"
            aria-label="Paid to"
            value={query.to ?? ''}
            min={query.from}
            onChange={(e) => update({ filters: { to: e.target.value } })}
            className="min-w-0 flex-1 lg:w-40 lg:flex-none"
          />
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => clear()} className="lg:ml-auto">
            Clear filters
          </Button>
        )}
      </div>
      {payments.isPending ? (
        <div className="px-5 pb-5">
          <LoadingState label="Loading payments" rows={8} />
        </div>
      ) : payments.isError ? (
        <ErrorState message={payments.error.message} onRetry={() => void payments.refetch()} retrying={payments.isFetching} />
      ) : (
        <>
          <DataTable
            caption="Payments"
            columns={columns}
            rows={payments.data.content}
            rowKey={(p) => p.id}
            sort={params.sort}
            onSortChange={(sort) => update({ sort: sort as PaymentListQuery['sort'] | null })}
            busy={payments.isPlaceholderData}
            emptyTitle={filtersActive ? 'No payments match your filters' : 'No payments yet'}
            emptyDescription={filtersActive ? 'Try a different search, status or date range.' : undefined}
          />
          <Pagination
            className="border-t border-line"
            page={payments.data.page}
            size={payments.data.size}
            totalElements={payments.data.totalElements}
            totalPages={payments.data.totalPages}
            onPageChange={(page) => update({ page })}
          />
        </>
      )}
      <ConfirmDialog
        open={resolving !== null}
        title={resolving?.status === 'COMPLETED' ? `Confirm ${resolving.payment.id} received?` : `Mark ${resolving?.payment.id ?? 'payment'} as failed?`}
        message={
          resolving && (
            <p>
              {formatCurrency(resolving.payment.amount)} by {enumLabel(resolving.payment.method)} from {resolving.payment.guestName} (
              {resolving.payment.invoiceNumber}).{' '}
              {resolving.status === 'COMPLETED'
                ? 'It will count towards the invoice and revenue.'
                : 'It will not count towards the invoice; the balance stays due.'}
            </p>
          )
        }
        confirmLabel={resolving?.status === 'COMPLETED' ? 'Confirm received' : 'Mark failed'}
        tone={resolving?.status === 'FAILED' ? 'danger' : 'primary'}
        loading={updateStatus.isPending}
        onConfirm={() => resolving && updateStatus.mutate({ paymentId: resolving.payment.id, status: resolving.status }, { onError: () => setResolving(null) })}
        onCancel={() => setResolving(null)}
      />
    </>
  )
}
