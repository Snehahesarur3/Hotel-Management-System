import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useDeleteRoom } from '@/hooks/useRooms'
import type { Room } from '@/types/domain'

interface DeleteRoomDialogProps {
  room: Room | null
  onClose: () => void
  onDeleted?: (room: Room) => void
}

/** Confirms deletion. The API refuses rooms with history; that message is shown as a toast. */
export function DeleteRoomDialog({ room, onClose, onDeleted }: DeleteRoomDialogProps) {
  const mutation = useDeleteRoom({
    onDeleted: (deleted) => {
      onClose()
      onDeleted?.(deleted)
    },
  })

  return (
    <ConfirmDialog
      open={room !== null}
      title={room ? `Delete room ${room.roomNumber}?` : 'Delete room?'}
      message={
        <>
          <p>This permanently removes the room from the inventory.</p>
          <p className="mt-2 text-xs text-ink-subtle">
            Rooms with reservations, housekeeping or restaurant history cannot be deleted. Set them to Maintenance instead.
          </p>
        </>
      }
      confirmLabel="Delete room"
      tone="danger"
      loading={mutation.isPending}
      onConfirm={() => room && mutation.mutate(room, { onError: onClose })}
      onCancel={onClose}
    />
  )
}
