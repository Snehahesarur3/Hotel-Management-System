import type { RoomService } from '@/api/types'
import { collection, applyListQuery, nextId } from '@/mock/collection'
import { PRIORITY_ORDER, toReservationSummary, toTaskSummary } from '@/mock/calculations/dashboard'
import { getDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import { arrivalToday as findArrivalToday, ROOM_HOLDING_STATUSES } from '@/mock/rules/roomStatus'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { MANUAL_ROOM_STATUSES, roomInputSchema } from '@/schemas/room'
import { ApiError } from '@/types/api'
import type { Room } from '@/types/domain'
import { ROOM_STATUSES, ROOM_TYPES, type RoomStatus } from '@/types/enums'
import type { RoomActivity, RoomInput, RoomListQuery } from '@/types/room'
import { todayISO } from '@/utils/date'
import { enumLabel } from '@/utils/format'

/**
 * Mock implementation of /api/rooms, including the business rules the backend enforces:
 * - room numbers are unique and start with their floor number (schema);
 * - Occupied/Reserved are workflow-driven and cannot be set or overridden by hand;
 * - capacity cannot drop below the party size of an active or upcoming booking;
 * - rooms with booking, housekeeping or restaurant history cannot be deleted (records stay intact).
 */
const rooms = collection('rooms', { resource: 'Room', idPrefix: 'RM' })

const byRoomNumber = (a: Room, b: Room) => a.roomNumber.localeCompare(b.roomNumber, 'en', { numeric: true })

function liveReservations(db: MockDatabase, roomId: string) {
  return db.reservations.filter((r) => r.roomId === roomId && ROOM_HOLDING_STATUSES.includes(r.status))
}

function arrivalToday(db: MockDatabase, roomId: string) {
  return findArrivalToday(db, roomId, todayISO())
}

function assertRoomNumberAvailable(roomNumber: string, exceptId?: string) {
  const clash = rooms.all().find((r) => r.roomNumber === roomNumber && r.id !== exceptId)
  if (clash) {
    const message = `Room ${roomNumber} already exists`
    throw new ApiError(409, message, { roomNumber: message })
  }
}

/**
 * Validates a manual status change and returns the status to store.
 * Setting "Available" on a room with an arrival today stores "Reserved" instead.
 */
function resolveManualStatus(room: Room, target: RoomStatus): RoomStatus {
  const db = getDatabase()
  if (target === room.status) return target
  if (room.status === 'OCCUPIED') {
    throw new ApiError(409, `Room ${room.roomNumber} has a guest in-house. Check the guest out to change its status.`)
  }
  if (room.status === 'RESERVED') {
    const arrival = arrivalToday(db, room.id)
    throw new ApiError(
      409,
      `Room ${room.roomNumber} is held for today's arrival${arrival ? ` (${arrival.id})` : ''}. Reassign or cancel that booking first.`,
    )
  }
  if (!(MANUAL_ROOM_STATUSES as readonly RoomStatus[]).includes(target)) {
    const message = `${enumLabel(target)} is set automatically by reservations and check-in`
    throw new ApiError(400, message, { status: message })
  }
  if (target === 'AVAILABLE' && arrivalToday(db, room.id)) return 'RESERVED'
  return target
}

function assertCapacityFits(room: Room, capacity: number) {
  const largest = liveReservations(getDatabase(), room.id).reduce((max, r) => Math.max(max, r.numberOfGuests), 0)
  if (capacity < largest) {
    const message = `An active or upcoming booking has ${largest} guests; capacity cannot be lower`
    throw new ApiError(409, message, { capacity: message })
  }
}

function list(query: RoomListQuery = {}) {
  const { floor, type, status } = query
  return applyListQuery(rooms.all(), query, {
    searchFields: (r) => [r.roomNumber, r.type, enumLabel(r.type), r.status, enumLabel(r.status), r.description, ...r.amenities],
    filter: (r) =>
      (floor === undefined || r.floor === floor) && (!type || r.type === type) && (!status || r.status === status),
    sortAccessors: {
      roomNumber: (r) => Number(r.roomNumber),
      type: (r) => ROOM_TYPES.indexOf(r.type),
      status: (r) => ROOM_STATUSES.indexOf(r.status),
    },
    defaultSort: byRoomNumber,
  })
}

function activity(id: string): RoomActivity {
  rooms.get(id) // 404 if missing
  const db = getDatabase()
  const stays = db.reservations.filter((r) => r.roomId === id)
  const summaries = (list: typeof stays) => list.map((r) => toReservationSummary(db, r))
  const current = stays.find((r) => r.status === 'CHECKED_IN')
  return {
    currentStay: current ? toReservationSummary(db, current) : null,
    upcoming: summaries(
      stays.filter((r) => r.status === 'PENDING' || r.status === 'CONFIRMED').sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    ),
    history: summaries(
      stays.filter((r) => r.status === 'CHECKED_OUT' || r.status === 'CANCELLED').sort((a, b) => b.checkIn.localeCompare(a.checkIn)),
    ),
    housekeeping: db.housekeepingTasks
      .filter((t) => t.roomId === id)
      .sort(
        (a, b) =>
          Number(a.status === 'COMPLETED') - Number(b.status === 'COMPLETED') ||
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          b.scheduledDate.localeCompare(a.scheduledDate),
      )
      .map((t) => toTaskSummary(db, t)),
  }
}

function create(raw: RoomInput): Room {
  const input = parseOrThrow(roomInputSchema, raw)
  assertRoomNumberAvailable(input.roomNumber)
  if (!(MANUAL_ROOM_STATUSES as readonly RoomStatus[]).includes(input.status)) {
    throw new ApiError(400, 'Validation failed', { status: 'A new room can only start as Available, Cleaning or Maintenance' })
  }
  const preferredId = `RM-${input.roomNumber}`
  const id = rooms.findById(preferredId) ? nextId(rooms.all().map((r) => r.id), 'RM') : preferredId
  return rooms.insert({ ...input, id })
}

function update(id: string, raw: RoomInput): Room {
  const room = rooms.get(id)
  const input = parseOrThrow(roomInputSchema, raw)
  assertRoomNumberAvailable(input.roomNumber, id)
  assertCapacityFits(room, input.capacity)
  const status = resolveManualStatus(room, input.status)
  return rooms.update(id, { ...input, status })
}

function updateStatus(id: string, status: RoomStatus): Room {
  if (!(ROOM_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError(400, 'Validation failed', { status: 'Unknown room status' })
  }
  const room = rooms.get(id)
  return rooms.update(id, { status: resolveManualStatus(room, status) })
}

function remove(id: string): void {
  const room = rooms.get(id)
  const db = getDatabase()
  const bookings = db.reservations.filter((r) => r.roomId === id).length
  const tasks = db.housekeepingTasks.filter((t) => t.roomId === id).length
  const orders = db.restaurantOrders.filter((o) => o.roomId === id).length
  if (bookings + tasks + orders > 0) {
    const parts = [
      bookings && `${bookings} reservation${bookings > 1 ? 's' : ''}`,
      tasks && `${tasks} housekeeping task${tasks > 1 ? 's' : ''}`,
      orders && `${orders} restaurant order${orders > 1 ? 's' : ''}`,
    ].filter(Boolean)
    throw new ApiError(
      409,
      `Room ${room.roomNumber} has history (${parts.join(', ')}) and cannot be deleted. Set it to Maintenance to take it out of service.`,
    )
  }
  rooms.remove(id)
}

export const mockRoomService: RoomService = {
  list: (query) => mockCall(() => list(query)),
  get: (id) => mockCall(() => rooms.get(id)),
  floors: () => mockCall(() => [...new Set(rooms.all().map((r) => r.floor))].sort((a, b) => a - b)),
  activity: (id) => mockCall(() => activity(id)),
  create: (input) => mockCall(() => create(input)),
  update: (id, input) => mockCall(() => update(id, input)),
  updateStatus: (id, status) => mockCall(() => updateStatus(id, status)),
  remove: (id) => mockCall(() => remove(id)),
}
