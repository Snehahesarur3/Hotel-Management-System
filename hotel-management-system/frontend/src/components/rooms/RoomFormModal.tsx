import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { Controller, useForm, type Path } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Field, PrefixedInput, SelectInput, TextArea, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { useCreateRoom, useUpdateRoom } from '@/hooks/useRooms'
import { MANUAL_ROOM_STATUSES, ROOM_AMENITIES, ROOM_TYPE_DEFAULTS, roomInputSchema, type RoomFormValues } from '@/schemas/room'
import type { ApiError } from '@/types/api'
import type { Room } from '@/types/domain'
import { ROOM_TYPES, type RoomType } from '@/types/enums'
import type { RoomInput } from '@/types/room'
import { enumLabel } from '@/utils/format'

interface RoomFormModalProps {
  open: boolean
  /** Room to edit; omit to create a new one. */
  room?: Room
  onClose: () => void
  onSaved?: (room: Room) => void
}

const NEW_ROOM: RoomFormValues = {
  roomNumber: '',
  floor: Number.NaN,
  type: 'STANDARD',
  capacity: ROOM_TYPE_DEFAULTS.STANDARD.capacity,
  pricePerNight: ROOM_TYPE_DEFAULTS.STANDARD.pricePerNight,
  amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV'],
  status: 'AVAILABLE',
  description: '',
}

function toFormValues(room: Room): RoomFormValues {
  const { id: _id, ...values } = room
  void _id
  return values
}

/** Add / edit room form. The modal is remounted per room so the form always starts fresh. */
export function RoomFormModal(props: RoomFormModalProps) {
  if (!props.open) return null
  return <RoomForm key={props.room?.id ?? 'new'} {...props} />
}

function RoomForm({ room, onClose, onSaved }: RoomFormModalProps) {
  const formId = useId()
  const editing = Boolean(room)
  const statusLocked = room?.status === 'OCCUPIED' || room?.status === 'RESERVED'
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    getFieldState,
    formState: { errors, isDirty },
  } = useForm<RoomFormValues, unknown, RoomInput>({
    resolver: zodResolver(roomInputSchema),
    defaultValues: room ? toFormValues(room) : NEW_ROOM,
    mode: 'onTouched',
  })

  /** Shows server-side field errors (e.g. duplicate room number) next to the fields. */
  const showFieldErrors = (error: ApiError) => {
    const entries = Object.entries(error.fieldErrors ?? {})
    entries.forEach(([field, message]) => setError(field as Path<RoomFormValues>, { message }))
    return entries.length > 0
  }
  const done = (saved: Room) => {
    onSaved?.(saved)
    onClose()
  }
  const create = useCreateRoom({ onSaved: done, onError: showFieldErrors })
  const update = useUpdateRoom({ onSaved: done, onError: showFieldErrors })
  const saving = create.isPending || update.isPending

  const onSubmit = handleSubmit((input) => (room ? update.mutate({ id: room.id, input }) : create.mutate(input)))

  // New rooms: suggest capacity and tariff for the chosen type unless the user already changed them.
  const applyTypeDefaults = (type: RoomType) => {
    if (editing) return
    const defaults = ROOM_TYPE_DEFAULTS[type]
    if (!getFieldState('capacity').isDirty) setValue('capacity', defaults.capacity)
    if (!getFieldState('pricePerNight').isDirty) setValue('pricePerNight', defaults.pricePerNight)
  }
  // Suggest the floor from the room number ("204" -> 2) until the user sets it explicitly.
  const suggestFloor = (roomNumber: string) => {
    if (!/^\d{3,4}$/.test(roomNumber) || getFieldState('floor').isDirty) return
    setValue('floor', Number(roomNumber.slice(0, -2)), { shouldValidate: getFieldState('floor').isTouched })
  }

  const extraAmenities = (room?.amenities ?? []).filter((a) => !(ROOM_AMENITIES as readonly string[]).includes(a))
  const amenityOptions = [...ROOM_AMENITIES, ...extraAmenities]

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      title={editing ? `Edit room ${room!.roomNumber}` : 'Add room'}
      description={editing ? 'Update the room’s details, tariff and amenities.' : 'Add a room to the hotel inventory.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={editing && !isDirty}>
            {editing ? 'Save changes' : 'Add room'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Room number" required error={errors.roomNumber?.message} hint="3–4 digits; starts with the floor">
          {(a) => (
            <TextInput
              {...a}
              inputMode="numeric"
              autoComplete="off"
              invalid={Boolean(errors.roomNumber)}
              {...register('roomNumber', { onChange: (e) => suggestFloor(e.target.value.trim()) })}
            />
          )}
        </Field>
        <Field label="Floor" required error={errors.floor?.message}>
          {(a) => <TextInput {...a} type="number" min={1} max={99} invalid={Boolean(errors.floor)} {...register('floor', { valueAsNumber: true })} />}
        </Field>
        <Field label="Room type" required error={errors.type?.message}>
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.type)} {...register('type', { onChange: (e) => applyTypeDefaults(e.target.value as RoomType) })}>
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {enumLabel(t)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label="Capacity (guests)" required error={errors.capacity?.message}>
          {(a) => <TextInput {...a} type="number" min={1} max={10} invalid={Boolean(errors.capacity)} {...register('capacity', { valueAsNumber: true })} />}
        </Field>
        <Field label="Price per night" required error={errors.pricePerNight?.message} hint="Excluding GST">
          {(a) => (
            <PrefixedInput
              {...a}
              prefix="₹"
              type="number"
              min={500}
              step="0.01"
              invalid={Boolean(errors.pricePerNight)}
              {...register('pricePerNight', { valueAsNumber: true })}
            />
          )}
        </Field>
        <Field
          label="Status"
          required
          error={errors.status?.message}
          hint={statusLocked ? 'Managed automatically by reservations and check-in/out' : 'Occupied and Reserved are set automatically'}
        >
          {(a) => (
            <SelectInput {...a} disabled={statusLocked} invalid={Boolean(errors.status)} {...register('status')}>
              {(statusLocked ? [room!.status] : MANUAL_ROOM_STATUSES).map((s) => (
                <option key={s} value={s}>
                  {enumLabel(s)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-ink">Amenities</legend>
          <Controller
            control={control}
            name="amenities"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {amenityOptions.map((amenity) => {
                  const checked = field.value.includes(amenity)
                  return (
                    <label key={amenity} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-line accent-brand-600"
                        checked={checked}
                        onChange={() =>
                          field.onChange(checked ? field.value.filter((a) => a !== amenity) : [...field.value, amenity])
                        }
                      />
                      {amenity}
                    </label>
                  )
                })}
              </div>
            )}
          />
          {errors.amenities?.message && <p className="mt-1 text-xs text-danger">{errors.amenities.message}</p>}
        </fieldset>

        <Field label="Description" className="sm:col-span-2" error={errors.description?.message} hint="Shown to front-desk staff; up to 500 characters">
          {(a) => <TextArea {...a} rows={3} invalid={Boolean(errors.description)} {...register('description')} />}
        </Field>
      </form>
    </Modal>
  )
}
