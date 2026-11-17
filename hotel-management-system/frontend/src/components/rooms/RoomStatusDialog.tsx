import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Modal'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useUpdateRoomStatus } from '@/hooks/useRooms'
import { MANUAL_ROOM_STATUSES } from '@/schemas/room'
import type { Room } from '@/types/domain'
import type { RoomStatus } from '@/types/enums'
import { cn } from '@/utils/cn'
import { enumLabel } from '@/utils/format'

const DESCRIPTIONS: Record<(typeof MANUAL_ROOM_STATUSES)[number], string> = {
  AVAILABLE: 'Clean, inspected and ready to sell. Becomes Reserved automatically if a guest arrives today.',
  CLEANING: 'Being cleaned or awaiting inspection; not sellable yet.',
  MAINTENANCE: 'Out of service for repairs; excluded from availability.',
}

interface RoomStatusDialogProps {
  room: Room | null
  onClose: () => void
}

/** Manual room status change, limited to the statuses staff may set. */
export function RoomStatusDialog({ room, onClose }: RoomStatusDialogProps) {
  if (!room) return null
  return <StatusForm key={room.id} room={room} onClose={onClose} />
}

function StatusForm({ room, onClose }: { room: Room; onClose: () => void }) {
  const locked = room.status === 'OCCUPIED' || room.status === 'RESERVED'
  const [target, setTarget] = useState<RoomStatus>(room.status)
  const mutation = useUpdateRoomStatus({ onSaved: onClose })

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      size="sm"
      title={`Change status of room ${room.roomNumber}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate({ id: room.id, status: target })}
            loading={mutation.isPending}
            disabled={locked || target === room.status}
          >
            Update status
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="flex items-center gap-2 text-ink-muted">
          Current status: <StatusBadge kind="room" status={room.status} />
        </p>
        {locked ? (
          <p className="rounded-lg bg-info-soft px-3 py-2 text-info">
            {room.status === 'OCCUPIED'
              ? 'A guest is in-house. The room becomes Cleaning automatically when the guest checks out.'
              : 'The room is held for a guest arriving today. Reassign or cancel that booking to release it.'}
          </p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="sr-only">New status</legend>
            {MANUAL_ROOM_STATUSES.map((status) => (
              <label
                key={status}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  target === status ? 'border-brand-500 bg-brand-50' : 'border-line hover:bg-canvas',
                )}
              >
                <input
                  type="radio"
                  name="room-status"
                  value={status}
                  checked={target === status}
                  onChange={() => setTarget(status)}
                  className="mt-0.5 accent-brand-600"
                />
                <span>
                  <span className="font-medium text-ink">{enumLabel(status)}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{DESCRIPTIONS[status]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </Modal>
  )
}
