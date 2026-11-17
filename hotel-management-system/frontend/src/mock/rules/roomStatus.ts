import type { MockDatabase } from '@/mock/seed'
import type { ISODate, Reservation } from '@/types/domain'
import type { BookingStatus } from '@/types/enums'

/**
 * Room-status rules shared by the rooms and reservations services.
 *
 * "Reserved" means: the room is ready and held for a guest arriving today. It is derived from
 * reservations, never set by hand:
 * - an Available room with a pending/confirmed arrival today becomes Reserved;
 * - a Reserved room whose arrival is cancelled, moved or re-dated becomes Available again.
 * Occupied, Cleaning and Maintenance are left alone (check-in/out and housekeeping own them).
 */

/** Bookings that hold a room for their dates. */
export const ROOM_HOLDING_STATUSES: readonly BookingStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN']

const isUpcoming = (r: Reservation) => r.status === 'PENDING' || r.status === 'CONFIRMED'

export function arrivalToday(db: MockDatabase, roomId: string, today: ISODate): Reservation | undefined {
  return db.reservations.find((r) => r.roomId === roomId && r.checkIn === today && isUpcoming(r))
}

/** Re-derives Available/Reserved for one room. Call on a mutateDatabase draft. */
export function syncRoomStatus(draft: MockDatabase, roomId: string, today: ISODate): void {
  const room = draft.rooms.find((r) => r.id === roomId)
  if (!room) return
  const held = Boolean(arrivalToday(draft, roomId, today))
  if (room.status === 'AVAILABLE' && held) room.status = 'RESERVED'
  else if (room.status === 'RESERVED' && !held) room.status = 'AVAILABLE'
}

/** Half-open night ranges: a departure on day X and an arrival on day X do not clash. */
export function staysOverlap(a: Pick<Reservation, 'checkIn' | 'checkOut'>, checkIn: ISODate, checkOut: ISODate): boolean {
  return a.checkIn < checkOut && checkIn < a.checkOut
}

/** Task types that keep a room in Cleaning until they are done. */
const CLEANING_TYPES = new Set(['CHECKOUT_CLEAN', 'DEEP_CLEAN'])

/**
 * After a housekeeping change: a room in Cleaning with no open checkout/deep clean left becomes
 * Available, or Reserved when a guest arrives today. Call on a mutateDatabase draft.
 */
export function releaseRoomIfClean(draft: MockDatabase, roomId: string, today: ISODate): boolean {
  const room = draft.rooms.find((r) => r.id === roomId)
  if (!room || room.status !== 'CLEANING') return false
  const stillCleaning = draft.housekeepingTasks.some(
    (t) => t.roomId === roomId && t.status !== 'COMPLETED' && CLEANING_TYPES.has(t.taskType),
  )
  if (stillCleaning) return false
  room.status = 'AVAILABLE'
  syncRoomStatus(draft, roomId, today)
  return true
}
