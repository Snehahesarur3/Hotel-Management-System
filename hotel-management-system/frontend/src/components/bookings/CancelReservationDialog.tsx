import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useCancelReservation } from '@/hooks/useReservations'
import type { ReservationSummary } from '@/types/dashboard'
import { formatDate } from '@/utils/format'

interface CancelReservationDialogProps {
  reservation: ReservationSummary | null
  onClose: () => void
  onCancelled?: (reservation: ReservationSummary) => void
}

/** Confirmation step before cancelling a booking (the booking is kept with status Cancelled). */
export function CancelReservationDialog({ reservation, onClose, onCancelled }: CancelReservationDialogProps) {
  const mutation = useCancelReservation({
    onCancelled: (cancelled) => {
      onClose()
      onCancelled?.(cancelled)
    },
  })
  return (
    <ConfirmDialog
      open={reservation !== null}
      title={reservation ? `Cancel booking ${reservation.id}?` : 'Cancel booking?'}
      message={
        reservation && (
          <>
            <p>
              <span className="font-medium text-ink">{reservation.guestName}</span> · Room {reservation.roomNumber} ·{' '}
              {formatDate(reservation.checkIn)} – {formatDate(reservation.checkOut)}
            </p>
            <p className="mt-2">The room is released for these dates. The booking stays on record as Cancelled and cannot be reinstated.</p>
          </>
        )
      }
      confirmLabel="Cancel booking"
      cancelLabel="Keep booking"
      tone="danger"
      loading={mutation.isPending}
      onConfirm={() => reservation && mutation.mutate(reservation.id, { onError: onClose })}
      onCancel={onClose}
    />
  )
}
