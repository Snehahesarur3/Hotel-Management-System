import { Leaf, Minus, Plus } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/common/Button'
import { Field, SelectInput, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { LoadingState } from '@/components/common/States'
import { useFrontDeskOverview } from '@/hooks/useFrontDesk'
import { useCreateOrder, useMenu } from '@/hooks/useRestaurant'
import { MAX_ORDER_QUANTITY, orderInputSchema } from '@/schemas/restaurant'
import type { ApiError } from '@/types/api'
import { MENU_CATEGORIES } from '@/types/enums'
import { cn } from '@/utils/cn'
import { enumLabel, formatCurrency } from '@/utils/format'
import { percentOf, roundMoney, sumMoney } from '@/utils/money'

const FOOD_GST = 5

interface OrderFormModalProps {
  open: boolean
  onClose: () => void
}

/** New order charged to an in-house stay: pick the room, then dishes and quantities. */
export function OrderFormModal({ open, onClose }: OrderFormModalProps) {
  if (!open) return null
  return <OrderForm onClose={onClose} />
}

function OrderForm({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const menuLabelId = useId()
  const stays = useFrontDeskOverview()
  const menu = useMenu({ available: true, size: 200 })
  const [reservationId, setReservationId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<{ reservationId?: string; items?: string }>({})
  const mutation = useCreateOrder({
    onDone: onClose,
    onError: (error: ApiError) => {
      const { reservationId: r, items } = error.fieldErrors ?? {}
      setErrors({ reservationId: r, items })
      return Boolean(r || items)
    },
  })

  const dishes = menu.data?.content ?? []
  const term = search.trim().toLowerCase()
  const visible = term ? dishes.filter((d) => d.name.toLowerCase().includes(term)) : dishes
  const lines = dishes.filter((d) => (quantities[d.id] ?? 0) > 0).map((d) => ({ dish: d, quantity: quantities[d.id]! }))
  const subtotal = sumMoney(lines.map((l) => l.dish.price * l.quantity))
  const gst = percentOf(subtotal, FOOD_GST)

  // Functional update: rapid clicks each count, even before React re-renders.
  const changeQuantity = (id: string, delta: number) => {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, Math.min(MAX_ORDER_QUANTITY, (q[id] ?? 0) + delta)) }))
    setErrors((e) => ({ ...e, items: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = orderInputSchema.safeParse({
      reservationId,
      items: lines.map((l) => ({ menuItemId: l.dish.id, quantity: l.quantity })),
    })
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === 'reservationId' ? 'reservationId' : 'items'
        next[field] ??= issue.message
      }
      setErrors(next)
      return
    }
    mutation.mutate(parsed.data)
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      size="lg"
      title="New order"
      description="Room service or restaurant bill, charged to an in-house guest’s room."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            {lines.length > 0 ? `Place order · ${formatCurrency(roundMoney(subtotal + gst))}` : 'Place order'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        <Field label="Charge to" required error={errors.reservationId} hint="Only checked-in guests can charge orders to their room.">
          {(a) => (
            <SelectInput
              {...a}
              value={reservationId}
              invalid={Boolean(errors.reservationId)}
              disabled={stays.isPending}
              onChange={(e) => {
                setReservationId(e.target.value)
                setErrors((x) => ({ ...x, reservationId: undefined }))
              }}
            >
              <option value="">{stays.isPending ? 'Loading in-house guests…' : 'Choose room / guest'}</option>
              {stays.data?.inHouse.map((s) => (
                <option key={s.id} value={s.id}>
                  Room {s.roomNumber} · {s.guestName} ({s.id})
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <section className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 id={menuLabelId} className="text-sm font-medium text-ink">
              Dishes
              <span className="ml-0.5 text-danger" aria-hidden>
                *
              </span>
            </h3>
            <TextInput
              type="search"
              aria-label="Search dishes"
              placeholder="Search dishes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              className="h-8 text-xs sm:w-48"
            />
          </div>
          {menu.isPending ? (
            <LoadingState label="Loading menu" rows={4} />
          ) : (
            <div role="group" aria-labelledby={menuLabelId} className="max-h-72 overflow-y-auto rounded-lg border border-line">
              {MENU_CATEGORIES.map((category) => {
                const inCategory = visible.filter((d) => d.category === category)
                if (inCategory.length === 0) return null
                return (
                  <div key={category}>
                    <p className="sticky top-0 z-10 border-b border-line bg-canvas px-3 py-1 text-xs font-medium text-ink-muted">{enumLabel(category)}</p>
                    <ul className="divide-y divide-line">
                      {inCategory.map((d) => {
                        const quantity = quantities[d.id] ?? 0
                        return (
                          <li key={d.id} className={cn('flex items-center gap-3 px-3 py-2', quantity > 0 && 'bg-brand-50')}>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-sm text-ink">
                                {d.name}
                                {d.isVegetarian && <Leaf className="size-3.5 text-success" aria-label="Vegetarian" />}
                              </span>
                              <span className="text-xs text-ink-muted">{formatCurrency(d.price, { whole: true })}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => changeQuantity(d.id, -1)}
                                disabled={quantity === 0}
                                className="grid size-7 place-items-center rounded-md border border-line text-ink-muted hover:bg-surface disabled:opacity-40"
                                aria-label={`One less ${d.name}`}
                              >
                                <Minus className="size-3.5" aria-hidden />
                              </button>
                              <span className="w-6 text-center text-sm tabular-nums" aria-live="polite" aria-label={`${d.name} quantity`}>
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => changeQuantity(d.id, 1)}
                                disabled={quantity >= MAX_ORDER_QUANTITY}
                                className="grid size-7 place-items-center rounded-md border border-line text-ink-muted hover:bg-surface disabled:opacity-40"
                                aria-label={`One more ${d.name}`}
                              >
                                <Plus className="size-3.5" aria-hidden />
                              </button>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
              {visible.length === 0 && <p className="px-3 py-3 text-sm text-ink-muted">No available dishes match “{search}”.</p>}
            </div>
          )}
          {errors.items && (
            <p className="text-xs text-danger" role="alert">
              {errors.items}
            </p>
          )}
        </section>

        {lines.length > 0 && (
          <dl aria-label="Order total" className="rounded-lg bg-canvas px-4 py-3 text-sm">
            {lines.map((l) => (
              <div key={l.dish.id} className="flex justify-between gap-4 py-0.5">
                <dt className="text-ink-muted">
                  {l.quantity} × {l.dish.name}
                </dt>
                <dd className="tabular-nums">{formatCurrency(l.dish.price * l.quantity)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 py-0.5">
              <dt className="text-ink-muted">GST {FOOD_GST}%</dt>
              <dd className="tabular-nums">{formatCurrency(gst)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-4 border-t border-line pt-1.5 font-semibold">
              <dt>Total charged to room</dt>
              <dd className="tabular-nums">{formatCurrency(roundMoney(subtotal + gst))}</dd>
            </div>
          </dl>
        )}
      </form>
    </Modal>
  )
}
