import { FlaskConical, Info } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { Field, SelectInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useCheckOut, useCheckOutPreview } from '@/hooks/useFrontDesk'
import { ApiError } from '@/types/api'
import type { ReservationSummary } from '@/types/dashboard'
import { PAYMENT_METHODS, type PaymentMethod } from '@/types/enums'
import type { CheckOutResult, StayBill } from '@/types/frontDesk'
import { enumLabel, formatCurrency, formatDate, formatDateTime } from '@/utils/format'

interface CheckOutDialogProps {
  reservation: ReservationSummary | null
  onClose: () => void
  onCheckedOut?: (result: CheckOutResult) => void
}

const hasFieldErrors = (error: ApiError) => Object.keys(error.fieldErrors ?? {}).length > 0

/** Final bill, settlement through the mock payment gateway, and check-out. */
export function CheckOutDialog({ reservation, onClose, onCheckedOut }: CheckOutDialogProps) {
  const formId = useId()
  const bill = useCheckOutPreview(reservation?.id ?? null)
  const mutation = useCheckOut({
    onDone: (result) => {
      onClose()
      onCheckedOut?.(result)
    },
    onError: hasFieldErrors,
  })
  if (!reservation) return null

  const balance = bill.data?.balance ?? 0
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      size="lg"
      title={`Check out ${reservation.guestName}`}
      description={`${reservation.id} · Room ${reservation.roomNumber}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          {bill.isSuccess && (
            <Button type="submit" form={formId} loading={mutation.isPending}>
              {balance > 0 ? `Collect ${formatCurrency(balance)} & check out` : 'Check out'}
            </Button>
          )}
        </>
      }
    >
      {bill.isPending ? (
        <LoadingState label="Preparing the final bill" rows={5} />
      ) : bill.isError ? (
        <ErrorState message={bill.error.message} onRetry={() => void bill.refetch()} retrying={bill.isFetching} />
      ) : (
        <CheckOutForm key={bill.data.reservationId} formId={formId} bill={bill.data} mutation={mutation} />
      )}
    </Modal>
  )
}

interface CheckOutFormProps {
  formId: string
  bill: StayBill
  mutation: ReturnType<typeof useCheckOut>
}

function CheckOutForm({ formId, bill, mutation }: CheckOutFormProps) {
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [methodError, setMethodError] = useState<string>()
  const due = bill.balance > 0
  const changedDeparture = bill.checkOut !== bill.bookedCheckOut

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (due && !method) {
      setMethodError('Choose how the guest is paying')
      return
    }
    mutation.mutate(
      { id: bill.reservationId, input: due ? { paymentMethod: method || undefined } : {} },
      { onError: (error) => error instanceof ApiError && setMethodError(error.fieldErrors?.paymentMethod) },
    )
  }

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-canvas px-3 py-2">
          <p className="text-xs text-ink-muted">Arrived</p>
          <p className="font-medium text-ink">{formatDate(bill.checkIn)}</p>
        </div>
        <div className="rounded-lg bg-canvas px-3 py-2">
          <p className="text-xs text-ink-muted">Departing</p>
          <p className="font-medium text-ink">{formatDate(bill.checkOut)}</p>
        </div>
        <div className="rounded-lg bg-canvas px-3 py-2">
          <p className="text-xs text-ink-muted">Nights billed</p>
          <p className="font-medium text-ink">{bill.nights}</p>
        </div>
      </div>
      {changedDeparture && (
        <p className="flex items-start gap-2 text-sm text-ink-muted" role="note">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          {bill.checkOut < bill.bookedCheckOut ? 'Early' : 'Late'} departure: booked until {formatDate(bill.bookedCheckOut)}. Only the
          nights used are billed{bill.nights === 1 ? ' (one-night minimum)' : ''}.
        </p>
      )}

      <section aria-labelledby={`${formId}-bill`}>
        <h3 id={`${formId}-bill`} className="mb-2 text-sm font-semibold text-ink">
          Final bill
        </h3>
        <dl className="divide-y divide-line rounded-lg border border-line text-sm">
          {bill.lines.map((line) => (
            <div key={line.kind} className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-ink-muted">{line.description}</dt>
              <dd className="text-ink tabular-nums">{formatCurrency(line.amount)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 px-3 py-2 font-semibold">
            <dt className="text-ink">Total</dt>
            <dd className="text-ink tabular-nums">{formatCurrency(bill.total)}</dd>
          </div>
          <div className="flex justify-between gap-4 px-3 py-2">
            <dt className="text-ink-muted">Paid</dt>
            <dd className="text-ink tabular-nums">− {formatCurrency(bill.paid)}</dd>
          </div>
          <div className="flex justify-between gap-4 bg-canvas px-3 py-2 font-semibold">
            <dt className="text-ink">{bill.balance >= 0 ? 'Balance due' : 'Guest in credit'}</dt>
            <dd className="text-ink tabular-nums">{formatCurrency(Math.abs(bill.balance))}</dd>
          </div>
        </dl>
      </section>

      {bill.payments.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-muted hover:text-ink">
            Payments on this stay ({bill.payments.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {bill.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink-muted">
                  {formatDateTime(p.paymentDate)} · {enumLabel(p.method)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{formatCurrency(p.amount)}</span>
                  <StatusBadge kind="payment" status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {due ? (
        <section className="space-y-2">
          <Field label={`Collect ${formatCurrency(bill.balance)} by`} required error={methodError}>
            {(a) => (
              <SelectInput
                {...a}
                value={method}
                invalid={Boolean(methodError)}
                onChange={(e) => {
                  setMethod(e.target.value as PaymentMethod | '')
                  setMethodError(undefined)
                }}
                className="sm:w-60"
              >
                <option value="">Choose payment method</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {enumLabel(m)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning" role="note">
            <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Mock payment: approved instantly with a test reference. No card, UPI or bank details are collected and no real
            transaction takes place.
          </p>
        </section>
      ) : (
        bill.balance < 0 && (
          <p className="text-sm text-ink-muted" role="note">
            The guest has paid {formatCurrency(-bill.balance)} more than the bill. Refund it from the{' '}
            <Link to={`/billing/invoices/${bill.reservationId}`} className="font-medium text-brand-700 hover:underline">
              invoice
            </Link>{' '}
            after check-out.
          </p>
        )
      )}
    </form>
  )
}
