import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/common/Button'
import { Field, PrefixedInput, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { useStockMovement, useStockMovements } from '@/hooks/useInventory'
import { stockInSchema, stockOutSchema } from '@/schemas/inventory'
import type { ApiError } from '@/types/api'
import { STOCK_IN_REASONS, STOCK_OUT_REASONS, type InventoryItemView } from '@/types/inventory'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'

type Errors = Partial<Record<'quantity' | 'reason' | 'unitCost', string>>
const toNumber = (v: string) => (v.trim() === '' ? Number.NaN : Number(v))

interface StockDialogProps {
  /** Item and direction; null closes the dialog. */
  target: { item: InventoryItemView; direction: 'in' | 'out' } | null
  onClose: () => void
}

/** Stock-in (receive) or stock-out (issue) for one item. */
export function StockMovementDialog({ target, onClose }: StockDialogProps) {
  if (!target) return null
  return <StockForm key={`${target.item.id}-${target.direction}`} item={target.item} direction={target.direction} onClose={onClose} />
}

function StockForm({ item, direction, onClose }: { item: InventoryItemView; direction: 'in' | 'out'; onClose: () => void }) {
  const formId = useId()
  const reasonsId = useId()
  const incoming = direction === 'in'
  // Suggest enough to reach twice the reorder level, so one receipt clears a low-stock alert.
  const suggested = item.minStockLevel * 2 - item.quantity
  const [quantity, setQuantity] = useState(incoming && item.stockStatus !== 'IN_STOCK' && suggested > 0 ? String(suggested) : '')
  const [reason, setReason] = useState<string>(incoming ? STOCK_IN_REASONS[0] : '')
  const [unitCost, setUnitCost] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const mutation = useStockMovement({
    onDone: onClose,
    onError: (error: ApiError) => {
      const { quantity: q, reason: r, unitCost: c } = error.fieldErrors ?? {}
      setErrors({ quantity: q, reason: r, unitCost: c })
      return Boolean(q || r || c)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const raw = { quantity: toNumber(quantity), reason, ...(incoming && unitCost.trim() ? { unitCost: toNumber(unitCost) } : {}) }
    const parsed = (incoming ? stockInSchema : stockOutSchema).safeParse(raw)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message
      setErrors(next)
      return
    }
    if (!incoming && parsed.data.quantity > item.quantity) {
      setErrors({ quantity: `Only ${item.quantity} ${item.unit} in stock` })
      return
    }
    mutation.mutate(incoming ? { id: item.id, direction: 'in', input: parsed.data } : { id: item.id, direction: 'out', input: parsed.data })
  }

  const after = Number.isInteger(toNumber(quantity)) ? item.quantity + (incoming ? 1 : -1) * toNumber(quantity) : null
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={`${incoming ? 'Stock in' : 'Stock out'} · ${item.name}`}
      description={`${item.quantity} ${item.unit} on hand · reorder at ${item.minStockLevel}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={mutation.isPending}
            icon={incoming ? <ArrowDownToLine className="size-4" aria-hidden /> : <ArrowUpFromLine className="size-4" aria-hidden />}
          >
            {incoming ? 'Receive stock' : 'Issue stock'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={`Quantity (${item.unit})`}
          required
          error={errors.quantity}
          hint={after !== null && after >= 0 ? `${after} ${item.unit} after this movement` : undefined}
        >
          {(a) => (
            <TextInput
              {...a}
              type="number"
              inputMode="numeric"
              min={1}
              max={incoming ? undefined : item.quantity}
              step={1}
              value={quantity}
              invalid={Boolean(errors.quantity)}
              onChange={(e) => {
                setQuantity(e.target.value)
                setErrors((x) => ({ ...x, quantity: undefined }))
              }}
            />
          )}
        </Field>
        {incoming && (
          <Field label="New unit cost" error={errors.unitCost} hint={`Optional; now ${formatCurrency(item.unitCost)}`}>
            {(a) => (
              <PrefixedInput
                {...a}
                prefix="₹"
                type="number"
                inputMode="decimal"
                min={0.01}
                step={0.01}
                value={unitCost}
                invalid={Boolean(errors.unitCost)}
                onChange={(e) => {
                  setUnitCost(e.target.value)
                  setErrors((x) => ({ ...x, unitCost: undefined }))
                }}
              />
            )}
          </Field>
        )}
        <Field label="Reason" required error={errors.reason} className="sm:col-span-2">
          {(a) => (
            <>
              <TextInput
                {...a}
                list={reasonsId}
                autoComplete="off"
                placeholder={incoming ? undefined : 'e.g. Issued to housekeeping'}
                value={reason}
                invalid={Boolean(errors.reason)}
                onChange={(e) => {
                  setReason(e.target.value)
                  setErrors((x) => ({ ...x, reason: undefined }))
                }}
              />
              <datalist id={reasonsId}>
                {(incoming ? STOCK_IN_REASONS : STOCK_OUT_REASONS).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </form>
    </Modal>
  )
}

/** Stock movement history of one item, newest first. */
export function MovementHistoryDialog({ item, onClose }: { item: InventoryItemView | null; onClose: () => void }) {
  const movements = useStockMovements(item?.id ?? null)
  if (!item) return null
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Stock history · ${item.name}`}
      description={`${item.quantity} ${item.unit} on hand · last restocked ${formatDate(item.lastRestocked)}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {movements.isPending ? (
        <LoadingState label="Loading stock history" rows={4} />
      ) : movements.isError ? (
        <ErrorState message={movements.error.message} onRetry={() => void movements.refetch()} retrying={movements.isFetching} />
      ) : movements.data.length === 0 ? (
        <EmptyState title="No movements recorded yet" description="Stock-in and stock-out made from here on appear in this list." />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Stock movements</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th scope="col" className="py-2 font-medium">
                  When
                </th>
                <th scope="col" className="py-2 font-medium">
                  Reason
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Change
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {movements.data.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                  <td className="py-2 text-ink-muted">{m.reason}</td>
                  <td className={cn('py-2 text-right font-medium tabular-nums', m.type === 'STOCK_IN' ? 'text-success' : 'text-ink')}>
                    {m.type === 'STOCK_IN' ? '+' : '−'}
                    {m.quantity}
                  </td>
                  <td className="py-2 text-right tabular-nums">{m.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
