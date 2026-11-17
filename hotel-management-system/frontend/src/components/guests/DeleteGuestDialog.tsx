import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useDeleteGuest } from '@/hooks/useGuests'
import type { GuestSummary } from '@/types/guest'

interface DeleteGuestDialogProps {
  guest: GuestSummary | null
  onClose: () => void
  onDeleted?: (guest: GuestSummary) => void
}

/** Confirms deletion. Guests with reservations are refused by the API (shown as a toast). */
export function DeleteGuestDialog({ guest, onClose, onDeleted }: DeleteGuestDialogProps) {
  const mutation = useDeleteGuest({
    onDeleted: (deleted) => {
      onClose()
      onDeleted?.(deleted)
    },
  })
  return (
    <ConfirmDialog
      open={guest !== null}
      title={guest ? `Delete ${guest.fullName}?` : 'Delete guest?'}
      message={
        <>
          <p>This permanently removes the guest profile.</p>
          <p className="mt-2 text-xs text-ink-subtle">Guests with reservations cannot be deleted, so booking history stays intact.</p>
        </>
      }
      confirmLabel="Delete guest"
      tone="danger"
      loading={mutation.isPending}
      onConfirm={() => guest && mutation.mutate(guest, { onError: onClose })}
      onCancel={onClose}
    />
  )
}
