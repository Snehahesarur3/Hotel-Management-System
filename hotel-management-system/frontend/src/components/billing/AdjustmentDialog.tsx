import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/common/Button'
import { Field, PrefixedInput, SelectInput, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { SegmentedControl } from '@/components/common/SegmentedControl'
import { useAddAdjustment } from '@/hooks/useBilling'
import { adjustmentInputSchema } from '@/schemas/billing'
import type { ApiError } from '@/types/api'
import { EXTRA_GST_RATES } from '@/types/billing'
import { formatCurrency } from '@/utils/format'
import { percentOf } from '@/utils/money'

/** Common extras offered as suggestions (any description is accepted). */
const EXTRA_SUGGESTIONS = ['Minibar', 'Laundry', 'Spa treatment', 'Airport transfer', 'Late check-out', 'Extra bed', 'Damages']

type FieldName = 'description' | 'amount' | 'percent' | 'gstPercent'
type Errors = Partial<Record<FieldName, string>>

const toErrors = (entries: Iterable<[string, string]>): Errors => {
  const errors: Errors = {}
  for (const [field, message] of entries) {
    if (field === 'description' || field === 'amount' || field === 'percent' || field === 'gstPercent') errors[field] ??= message
  }
  return errors
}
const toNumber = (v: string) => (v.trim() === '' ? Number.NaN : Number(v))

interface AdjustmentDialogProps {
  /** Which kind to add; null closes the dialog. */
  kind: 'EXTRA' | 'DISCOUNT' | null
  reservationId: string
  invoiceNumber: string
  /** Room charges and existing discount, to preview percentage discounts. */
  roomCharges: number
  discount: number
  onClose: () => void
}

/** Posts an extra charge or a discount to an open folio. */
export function AdjustmentDialog(props: AdjustmentDialogProps) {
  if (!props.kind) return null
  return <AdjustmentForm key={props.kind} {...props} kind={props.kind} />
}

function AdjustmentForm({ kind, reservationId, invoiceNumber, roomCharges, discount, onClose }: AdjustmentDialogProps & { kind: 'EXTRA' | 'DISCOUNT' }) {
  const formId = useId()
  const listId = useId()
  const extra = kind === 'EXTRA'
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [percent, setPercent] = useState('')
  const [gstPercent, setGstPercent] = useState('18')
  const [mode, setMode] = useState<'percent' | 'amount'>('percent')
  const [errors, setErrors] = useState<Errors>({})
  const clear = (field: FieldName) => setErrors((e) => ({ ...e, [field]: undefined }))

  const mutation = useAddAdjustment({
    onDone: onClose,
    onError: (error: ApiError) => {
      const next = toErrors(Object.entries(error.fieldErrors ?? {}))
      setErrors(next)
      return Object.keys(next).length > 0
    },
  })

  const remaining = Math.max(0, roomCharges - discount)
  const percentValue = toNumber(percent)
  const preview = !extra && mode === 'percent' && Number.isFinite(percentValue) ? percentOf(roomCharges, percentValue) : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const raw = extra
      ? { kind, description, amount: toNumber(amount), gstPercent: Number(gstPercent) }
      : { kind, description, ...(mode === 'amount' ? { amount: toNumber(amount) } : { percent: toNumber(percent) }) }
    const parsed = adjustmentInputSchema.safeParse(raw)
    if (!parsed.success) {
      setErrors(toErrors(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    mutation.mutate({ reservationId, input: parsed.data })
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={extra ? `Add charge · ${invoiceNumber}` : `Add discount · ${invoiceNumber}`}
      description={
        extra
          ? 'Post an extra such as minibar, laundry or transport. GST is added at the rate you choose.'
          : `Discounts reduce the room charges before GST. ${formatCurrency(remaining)} of room charges can still be discounted.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {extra ? 'Add charge' : 'Add discount'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <Field label={extra ? 'Description' : 'Reason'} required error={errors.description}>
          {(a) => (
            <>
              <TextInput
                {...a}
                list={extra ? listId : undefined}
                autoComplete="off"
                placeholder={extra ? 'e.g. Laundry' : 'e.g. Corporate rate, service recovery'}
                value={description}
                invalid={Boolean(errors.description)}
                onChange={(e) => {
                  setDescription(e.target.value)
                  clear('description')
                }}
              />
              {extra && (
                <datalist id={listId}>
                  {EXTRA_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </>
          )}
        </Field>

        {extra ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Amount (before GST)" required error={errors.amount}>
              {(a) => (
                <PrefixedInput
                  {...a}
                  prefix="₹"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.01}
                  value={amount}
                  invalid={Boolean(errors.amount)}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    clear('amount')
                  }}
                />
              )}
            </Field>
            <Field label="GST rate" required error={errors.gstPercent}>
              {(a) => (
                <SelectInput {...a} value={gstPercent} onChange={(e) => setGstPercent(e.target.value)}>
                  {EXTRA_GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r === 0 ? 'Exempt (0%)' : `${r}%`}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <SegmentedControl
              label="Discount type"
              value={mode}
              options={[
                { value: 'percent', label: 'Percentage' },
                { value: 'amount', label: 'Fixed amount' },
              ]}
              onChange={(m) => {
                setMode(m)
                setErrors({})
              }}
            />
            {mode === 'percent' ? (
              <Field
                label="Percentage of room charges"
                required
                error={errors.percent ?? errors.amount}
                hint={preview !== null ? `${formatCurrency(preview)} off ${formatCurrency(roomCharges)}; follows the nights if the stay changes.` : undefined}
              >
                {(a) => (
                  <TextInput
                    {...a}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={100}
                    step={0.1}
                    value={percent}
                    invalid={Boolean(errors.percent ?? errors.amount)}
                    onChange={(e) => {
                      setPercent(e.target.value)
                      setErrors({})
                    }}
                    className="sm:w-40"
                  />
                )}
              </Field>
            ) : (
              <Field label="Amount" required error={errors.amount}>
                {(a) => (
                  <PrefixedInput
                    {...a}
                    prefix="₹"
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    max={remaining}
                    step={0.01}
                    value={amount}
                    invalid={Boolean(errors.amount)}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      clear('amount')
                    }}
                  />
                )}
              </Field>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
