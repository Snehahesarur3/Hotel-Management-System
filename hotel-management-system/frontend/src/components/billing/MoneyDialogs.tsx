import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/common/Button'
import { Field, PrefixedInput, SelectInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { useRecordPayment, useRefund } from '@/hooks/useBilling'
import { paymentInputSchema, refundInputSchema } from '@/schemas/billing'
import type { ApiError } from '@/types/api'
import { PAYMENT_METHODS, type PaymentMethod } from '@/types/enums'
import { enumLabel, formatCurrency } from '@/utils/format'
import { MockPaymentNotice } from './MockPaymentNotice'

type Errors = Partial<Record<'amount' | 'method', string>>

/** Maps zod issues / API field errors onto this form's fields. */
function toErrors(entries: Iterable<[string, string]>): Errors {
  const errors: Errors = {}
  for (const [field, message] of entries) if (field === 'amount' || field === 'method') errors[field] ??= message
  return errors
}

function MethodSelect({ value, onChange, error, label }: { value: string; onChange: (v: string) => void; error?: string; label: string }) {
  return (
    <Field label={label} required error={error}>
      {(a) => (
        <SelectInput {...a} value={value} invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose payment method</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {enumLabel(m)}
            </option>
          ))}
        </SelectInput>
      )}
    </Field>
  )
}

interface PaymentDialogProps {
  /** Folio to pay; null closes the dialog. */
  target: { reservationId: string; invoiceNumber: string; balance: number } | null
  onClose: () => void
}

/** Takes a full or part payment towards a folio's balance (mock gateway). */
export function RecordPaymentDialog({ target, onClose }: PaymentDialogProps) {
  if (!target) return null
  return <RecordPaymentForm key={target.reservationId} target={target} onClose={onClose} />
}

function RecordPaymentForm({ target, onClose }: { target: NonNullable<PaymentDialogProps['target']>; onClose: () => void }) {
  const formId = useId()
  const [amount, setAmount] = useState(String(target.balance))
  const [method, setMethod] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const mutation = useRecordPayment({
    onDone: onClose,
    onError: (error: ApiError) => {
      const next = toErrors(Object.entries(error.fieldErrors ?? {}))
      setErrors(next)
      return Object.keys(next).length > 0
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = paymentInputSchema.safeParse({ amount: amount === '' ? Number.NaN : Number(amount), method: method || undefined })
    if (!parsed.success) {
      setErrors(toErrors(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    if (parsed.data.amount > target.balance) {
      setErrors({ amount: `At most ${formatCurrency(target.balance)} (the balance due)` })
      return
    }
    mutation.mutate({ reservationId: target.reservationId, input: parsed.data })
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={`Record payment · ${target.invoiceNumber}`}
      description={`Balance due ${formatCurrency(target.balance)}. Part-payments are allowed.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            Take payment
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <Field label="Amount" required error={errors.amount}>
          {(a) => (
            <PrefixedInput
              {...a}
              prefix="₹"
              type="number"
              inputMode="decimal"
              min={0.01}
              max={target.balance}
              step={0.01}
              value={amount}
              invalid={Boolean(errors.amount)}
              onChange={(e) => {
                setAmount(e.target.value)
                setErrors((x) => ({ ...x, amount: undefined }))
              }}
            />
          )}
        </Field>
        <MethodSelect
          label="Payment method"
          value={method}
          error={errors.method}
          onChange={(v) => {
            setMethod(v)
            setErrors((x) => ({ ...x, method: undefined }))
          }}
        />
        <MockPaymentNotice />
      </form>
    </Modal>
  )
}

interface RefundDialogProps {
  target: { reservationId: string; invoiceNumber: string; credit: number } | null
  onClose: () => void
}

/** Returns a folio's whole credit balance to the guest (mock gateway). */
export function RefundDialog({ target, onClose }: RefundDialogProps) {
  if (!target) return null
  return <RefundForm key={target.reservationId} target={target} onClose={onClose} />
}

function RefundForm({ target, onClose }: { target: NonNullable<RefundDialogProps['target']>; onClose: () => void }) {
  const formId = useId()
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [error, setError] = useState<string>()
  const mutation = useRefund({ onDone: onClose })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = refundInputSchema.safeParse({ method: method || undefined })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message)
      return
    }
    mutation.mutate({ reservationId: target.reservationId, input: parsed.data })
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      size="sm"
      title={`Refund ${formatCurrency(target.credit)}`}
      description={`${target.invoiceNumber} is in credit. The whole credit is returned to the guest.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            Refund {formatCurrency(target.credit)}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <MethodSelect
          label="Refund to"
          value={method}
          error={error}
          onChange={(v) => {
            setMethod(v as PaymentMethod | '')
            setError(undefined)
          }}
        />
        <MockPaymentNotice refund />
      </form>
    </Modal>
  )
}
