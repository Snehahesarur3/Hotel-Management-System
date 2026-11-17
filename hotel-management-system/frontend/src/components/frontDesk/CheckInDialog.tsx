import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, BedDouble, ShieldCheck } from 'lucide-react'
import { useId } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Field, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { ErrorState, LoadingState } from '@/components/common/States'
import { useCheckIn, useCheckInPreview } from '@/hooks/useFrontDesk'
import { checkInSchema, type CheckInFormValues } from '@/schemas/frontDesk'
import { ApiError } from '@/types/api'
import type { ReservationSummary } from '@/types/dashboard'
import type { CheckInInput, CheckInPreview } from '@/types/frontDesk'
import { cn } from '@/utils/cn'
import { enumLabel, formatDate } from '@/utils/format'

interface CheckInDialogProps {
  reservation: ReservationSummary | null
  onClose: () => void
  onCheckedIn?: (reservation: ReservationSummary) => void
}

const hasFieldErrors = (error: ApiError) => Object.keys(error.fieldErrors ?? {}).length > 0

/** Verify the guest's ID, assign a ready room and check in. */
export function CheckInDialog({ reservation, onClose, onCheckedIn }: CheckInDialogProps) {
  const formId = useId()
  const preview = useCheckInPreview(reservation?.id ?? null)
  // Field errors (ID mismatch, room no longer ready) are shown next to the fields instead of a toast.
  const mutation = useCheckIn({
    onDone: (r) => {
      onClose()
      onCheckedIn?.(r)
    },
    onError: hasFieldErrors,
  })
  if (!reservation) return null

  const party = `${reservation.numberOfGuests} guest${reservation.numberOfGuests > 1 ? 's' : ''}`
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      size="lg"
      title={`Check in ${reservation.guestName}`}
      description={`${reservation.id} · ${formatDate(reservation.checkIn)} – ${formatDate(reservation.checkOut)} · ${party}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          {preview.isSuccess && (
            <Button type="submit" form={formId} loading={mutation.isPending}>
              Check in
            </Button>
          )}
        </>
      }
    >
      {preview.isPending ? (
        <LoadingState label="Loading check-in details" rows={4} />
      ) : preview.isError ? (
        <ErrorState message={preview.error.message} onRetry={() => void preview.refetch()} retrying={preview.isFetching} />
      ) : (
        <CheckInForm key={preview.data.reservation.id} formId={formId} preview={preview.data} mutation={mutation} />
      )}
    </Modal>
  )
}

interface CheckInFormProps {
  formId: string
  preview: CheckInPreview
  mutation: ReturnType<typeof useCheckIn>
}

function CheckInForm({ formId, preview, mutation }: CheckInFormProps) {
  const roomsLabelId = useId()
  const { reservation, rooms, idProofType, lateArrival } = preview
  const booked = rooms.find((o) => o.booked)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CheckInFormValues, unknown, CheckInInput>({
    resolver: zodResolver(checkInSchema),
    defaultValues: { idLast4: '', roomId: booked?.ready ? booked.room.id : '' },
  })

  const showFieldErrors = (error: Error) => {
    if (!(error instanceof ApiError)) return
    Object.entries(error.fieldErrors ?? {}).forEach(([field, message]) => setError(field as Path<CheckInFormValues>, { message }))
  }
  const onSubmit = handleSubmit((input) => mutation.mutate({ id: reservation.id, input }, { onError: showFieldErrors }))

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5">
      {lateArrival && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning" role="note">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Late arrival: the booking started on {formatDate(reservation.checkIn)}. The booked nights are still charged.
        </p>
      )}

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="size-4 text-ink-subtle" aria-hidden /> Verify identity
        </h3>
        <Field
          label={`Last 4 characters of the guest's ${enumLabel(idProofType)}`}
          required
          error={errors.idLast4?.message}
          hint="Read them from the original document. They are checked against the masked number on file."
        >
          {(a) => (
            <TextInput
              {...a}
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              className="font-mono uppercase sm:w-40"
              invalid={Boolean(errors.idLast4)}
              {...register('idLast4')}
            />
          )}
        </Field>
      </section>

      <section className="space-y-2">
        <h3 id={roomsLabelId} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <BedDouble className="size-4 text-ink-subtle" aria-hidden /> Assign room
        </h3>
        {booked && !booked.ready && (
          <p className="text-sm text-ink-muted">
            The booked room isn’t ready ({booked.reason?.toLowerCase()}). Choose another ready room; the guest keeps the booked rate.
          </p>
        )}
        <div className="max-h-60 overflow-y-auto rounded-lg border border-line">
          <ul role="radiogroup" aria-labelledby={roomsLabelId} className="divide-y divide-line">
            {rooms.map(({ room, booked: isBooked, ready, reason }) => (
              <li key={room.id}>
                <label
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 has-[:checked]:bg-brand-50',
                    ready ? 'cursor-pointer hover:bg-canvas' : 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input type="radio" value={room.id} disabled={!ready} className="size-4 accent-brand-600" {...register('roomId')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      Room {room.roomNumber}
                      <span className="font-normal text-ink-muted">· {enumLabel(room.type)}</span>
                      {isBooked && <Badge tone="brand">Booked</Badge>}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      Floor {room.floor} · sleeps {room.capacity}
                      {room.amenities.length > 0 && ` · ${room.amenities.slice(0, 3).join(', ')}`}
                    </span>
                  </span>
                  <span className={cn('shrink-0 text-xs font-medium', ready ? 'text-success' : 'text-danger')}>{ready ? 'Ready' : reason}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        {errors.roomId?.message && (
          <p className="text-xs text-danger" role="alert">
            {errors.roomId.message}
          </p>
        )}
      </section>
    </form>
  )
}
