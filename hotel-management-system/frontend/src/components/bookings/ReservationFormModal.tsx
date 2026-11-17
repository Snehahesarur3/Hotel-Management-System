import { zodResolver } from '@hookform/resolvers/zod'
import { BedDouble, Users } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useForm, useWatch, type Path, type UseFormRegisterReturn } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Field, SelectInput, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { useAvailability, useCreateReservation, useUpdateReservation } from '@/hooks/useReservations'
import { MAX_GUESTS, MAX_NIGHTS, reservationInputSchema, type ReservationFormValues } from '@/schemas/reservation'
import type { ApiError } from '@/types/api'
import type { ReservationSummary } from '@/types/dashboard'
import { BOOKING_SOURCES, ROOM_TYPES, type RoomType } from '@/types/enums'
import { BOOKABLE_STATUSES, type AvailabilityQuery, type AvailableRoom, type ReservationInput } from '@/types/reservation'
import { cn } from '@/utils/cn'
import { addDays, diffDays, todayISO } from '@/utils/date'
import { enumLabel, formatCurrency } from '@/utils/format'
import { GuestPicker, type PickedGuest } from './GuestPicker'

interface ReservationFormModalProps {
  open: boolean
  /** Booking to edit; omit to create one. */
  reservation?: ReservationSummary
  /** Pre-selected guest for a new booking (e.g. from the guest profile). */
  guest?: PickedGuest
  onClose: () => void
  onSaved?: (reservation: ReservationSummary) => void
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function ReservationFormModal(props: ReservationFormModalProps) {
  if (!props.open) return null
  return <ReservationForm key={props.reservation?.id ?? `new-${props.guest?.id ?? ''}`} {...props} />
}

function ReservationForm({ reservation, guest: presetGuest, onClose, onSaved }: ReservationFormModalProps) {
  const formId = useId()
  const roomLabelId = useId()
  const editing = Boolean(reservation)
  const today = todayISO()
  const earliestCheckIn = reservation && reservation.checkIn < today ? reservation.checkIn : today
  const schema = useMemo(() => reservationInputSchema({ earliestCheckIn }), [earliestCheckIn])

  const [guest, setGuest] = useState<PickedGuest | null>(
    reservation ? { id: reservation.guestId, fullName: reservation.guestName, detail: reservation.guestId } : (presetGuest ?? null),
  )
  const [roomType, setRoomType] = useState<RoomType | ''>('')

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<ReservationFormValues, unknown, ReservationInput>({
    resolver: zodResolver(schema),
    defaultValues: reservation
      ? {
          guestId: reservation.guestId,
          roomId: reservation.roomId,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          numberOfGuests: reservation.numberOfGuests,
          source: reservation.source,
          status: reservation.status === 'PENDING' ? 'PENDING' : 'CONFIRMED',
        }
      : {
          guestId: presetGuest?.id ?? '',
          roomId: '',
          checkIn: today,
          checkOut: addDays(today, 1),
          numberOfGuests: 2,
          source: 'WALK_IN',
          status: 'CONFIRMED',
        },
    mode: 'onTouched',
  })
  const [checkIn, checkOut, partySize, roomId] = useWatch({ control, name: ['checkIn', 'checkOut', 'numberOfGuests', 'roomId'] })

  // Ask for availability only once the stay itself is valid (mirrors the API's checks).
  const nights = ISO.test(checkIn) && ISO.test(checkOut) ? diffDays(checkIn, checkOut) : 0
  const stayValid =
    nights >= 1 && nights <= MAX_NIGHTS && checkIn >= earliestCheckIn && Number.isInteger(partySize) && partySize >= 1 && partySize <= MAX_GUESTS
  const availabilityQuery: AvailabilityQuery | null = stayValid
    ? { checkIn, checkOut, guests: partySize, type: roomType || undefined, excludeReservationId: reservation?.id }
    : null
  const availability = useAvailability(availabilityQuery)
  const rooms = stayValid ? (availability.data ?? []) : []
  const selected = rooms.find((r) => r.room.id === roomId)
  // The chosen room dropped out after a date/party/type change.
  const selectionLost = Boolean(roomId && stayValid && availability.isSuccess && !availability.isPlaceholderData && !selected)

  const pickGuest = (picked: PickedGuest | null) => {
    setGuest(picked)
    setValue('guestId', picked?.id ?? '', { shouldDirty: true, shouldValidate: Boolean(picked) })
  }

  const showFieldErrors = (error: ApiError) => {
    const entries = Object.entries(error.fieldErrors ?? {})
    entries.forEach(([field, message]) => setError(field as Path<ReservationFormValues>, { message }))
    return entries.length > 0
  }
  const done = (saved: ReservationSummary) => {
    onSaved?.(saved)
    onClose()
  }
  const create = useCreateReservation({ onSaved: done, onError: showFieldErrors })
  const update = useUpdateReservation({ onSaved: done, onError: showFieldErrors })
  const saving = create.isPending || update.isPending

  const onSubmit = handleSubmit((input) => {
    if (selectionLost) {
      setError('roomId', { message: 'The selected room is not available for these dates. Choose another room.' })
      return
    }
    if (reservation) update.mutate({ id: reservation.id, input })
    else create.mutate(input)
  })

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      title={editing ? `Edit booking ${reservation!.id}` : 'New reservation'}
      description={editing ? 'Change the guest, dates or room. The room is re-checked for clashes.' : 'Pick the guest and dates, then choose an available room.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={editing && !isDirty}>
            {editing ? 'Save changes' : 'Create booking'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5">
        <input type="hidden" {...register('guestId')} />
        <GuestPicker value={guest} onChange={pickGuest} error={errors.guestId?.message} disabled={saving} />

        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <legend className="sr-only">Stay</legend>
          <Field label="Check-in" required error={errors.checkIn?.message}>
            {(a) => <TextInput {...a} type="date" min={earliestCheckIn} invalid={Boolean(errors.checkIn)} {...register('checkIn')} />}
          </Field>
          <Field
            label="Check-out"
            required
            error={errors.checkOut?.message}
            hint={nights >= 1 ? `${nights} night${nights > 1 ? 's' : ''}` : undefined}
          >
            {(a) => (
              <TextInput
                {...a}
                type="date"
                min={ISO.test(checkIn) ? addDays(checkIn, 1) : undefined}
                invalid={Boolean(errors.checkOut)}
                {...register('checkOut')}
              />
            )}
          </Field>
          <Field label="Guests" required error={errors.numberOfGuests?.message}>
            {(a) => (
              <TextInput
                {...a}
                type="number"
                min={1}
                max={MAX_GUESTS}
                step={1}
                inputMode="numeric"
                invalid={Boolean(errors.numberOfGuests)}
                {...register('numberOfGuests', { valueAsNumber: true })}
              />
            )}
          </Field>
        </fieldset>

        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <span id={roomLabelId} className="text-sm font-medium text-ink">
              Room
              <span className="ml-0.5 text-danger" aria-hidden>
                *
              </span>
            </span>
            <SelectInput aria-label="Room type" value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType | '')} className="h-8 text-xs sm:w-48">
              <option value="">All room types</option>
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {enumLabel(t)}
                </option>
              ))}
            </SelectInput>
          </div>
          <RoomOptions
            stayValid={stayValid}
            loading={availability.isPending && stayValid}
            error={availability.isError ? availability.error.message : undefined}
            busy={availability.isPlaceholderData}
            rooms={rooms}
            partySize={partySize}
            labelledBy={roomLabelId}
            register={register('roomId', { onChange: () => clearErrors('roomId') })}
          />
          {(errors.roomId?.message || selectionLost) && (
            <p className="text-xs text-danger" role="alert">
              {errors.roomId?.message ?? 'The selected room is not available for these dates. Choose another room.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Booking source" required error={errors.source?.message}>
            {(a) => (
              <SelectInput {...a} invalid={Boolean(errors.source)} {...register('source')}>
                {BOOKING_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {enumLabel(s)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label="Status" required error={errors.status?.message} hint="Pending: awaiting guarantee or deposit.">
            {(a) => (
              <SelectInput {...a} invalid={Boolean(errors.status)} {...register('status')}>
                {BOOKABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {enumLabel(s)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>

        {selected && (
          <dl aria-label="Charges" className="rounded-lg bg-canvas px-4 py-3 text-sm">
            <div className="flex justify-between gap-4 py-0.5">
              <dt className="text-ink-muted">
                Room {selected.room.roomNumber} · {selected.quote.nights} night{selected.quote.nights > 1 ? 's' : ''} ×{' '}
                {formatCurrency(selected.quote.roomRate)}
              </dt>
              <dd className="text-ink tabular-nums">{formatCurrency(selected.quote.roomCharges)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-0.5">
              <dt className="text-ink-muted">GST {selected.quote.gstPercent}%</dt>
              <dd className="text-ink tabular-nums">{formatCurrency(selected.quote.gstAmount)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-4 border-t border-line pt-1.5 font-semibold">
              <dt className="text-ink">Estimated total</dt>
              <dd className="text-ink tabular-nums">{formatCurrency(selected.quote.total)}</dd>
            </div>
            <p className="mt-1 text-xs text-ink-subtle">Restaurant and other charges are added to the final bill.</p>
          </dl>
        )}
      </form>
    </Modal>
  )
}

interface RoomOptionsProps {
  stayValid: boolean
  loading: boolean
  error?: string
  busy: boolean
  rooms: AvailableRoom[]
  partySize: number
  labelledBy: string
  register: UseFormRegisterReturn<'roomId'>
}

function RoomOptions({ stayValid, loading, error, busy, rooms, partySize, labelledBy, register }: RoomOptionsProps) {
  const box = 'rounded-lg border border-line px-3 py-3 text-sm text-ink-muted'
  if (!stayValid) return <p className={box}>Enter valid dates and the number of guests to see available rooms.</p>
  if (loading) return <p className={box}>Checking availability…</p>
  if (error) return <p className={cn(box, 'text-danger')}>Could not check availability: {error}</p>
  if (rooms.length === 0) {
    return <p className={box}>No rooms are free for {partySize} guest{partySize > 1 ? 's' : ''} on these dates. Try other dates or room types.</p>
  }
  return (
    <div className={cn('max-h-64 overflow-y-auto rounded-lg border border-line', busy && 'opacity-60')}>
      <p className="sticky top-0 z-10 border-b border-line bg-surface px-3 py-1.5 text-xs text-ink-muted">
        {rooms.length} room{rooms.length > 1 ? 's' : ''} available
      </p>
      <ul role="radiogroup" aria-labelledby={labelledBy} className="divide-y divide-line">
        {rooms.map(({ room, quote }) => (
          <li key={room.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-canvas has-[:checked]:bg-brand-50">
              <input type="radio" value={room.id} className="size-4 accent-brand-600" {...register} />
              <BedDouble className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                  Room {room.roomNumber} <span className="font-normal text-ink-muted">· {enumLabel(room.type)}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-ink-muted">
                  Floor {room.floor} · <Users className="size-3" aria-hidden /> up to {room.capacity} · {formatCurrency(quote.roomRate, { whole: true })}/night
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-medium text-ink tabular-nums">{formatCurrency(quote.total, { whole: true })}</span>
                <span className="block text-xs text-ink-subtle">incl. {quote.gstPercent}% GST</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
