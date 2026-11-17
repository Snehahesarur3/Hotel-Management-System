import type { ReservationService } from '@/api/types'
import { applyListQuery, collection, nextId } from '@/mock/collection'
import { completedRevenue, toReservationSummary } from '@/mock/calculations/dashboard'
import { getDatabase, mutateDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import { ROOM_HOLDING_STATUSES, staysOverlap, syncRoomStatus } from '@/mock/rules/roomStatus'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { MAX_GUESTS, MAX_NIGHTS, reservationInputSchema } from '@/schemas/reservation'
import { ApiError } from '@/types/api'
import type { ReservationSummary } from '@/types/dashboard'
import type { ISODate, Reservation, Room } from '@/types/domain'
import { BOOKING_STATUSES, ROOM_TYPES } from '@/types/enums'
import type {
  AvailabilityQuery,
  AvailableRoom,
  ReservationDetails,
  ReservationInput,
  ReservationListQuery,
} from '@/types/reservation'
import { quoteStay } from '@/utils/charges'
import { diffDays, nowISODateTime, todayISO } from '@/utils/date'
import { enumLabel, formatShortDate } from '@/utils/format'

/**
 * Mock implementation of /api/reservations, with the rules the backend enforces:
 * - a room cannot hold two pending/confirmed/checked-in bookings on the same night;
 * - the party must fit the room, and rooms under maintenance are not bookable;
 * - check-in cannot be in the past; stays are 1–30 nights;
 * - the nightly rate is locked in at booking time (kept on date changes, re-locked on a room change);
 * - only pending/confirmed bookings can be edited or cancelled;
 * - every change re-derives the Available/Reserved status of the rooms involved.
 */
const reservations = collection('reservations', { resource: 'Reservation', idPrefix: 'BK' })

const isEditable = (r: Reservation) => r.status === 'PENDING' || r.status === 'CONFIRMED'
const slabs = (db: MockDatabase) => db.settings.taxes.roomGstSlabs

function conflicts(db: MockDatabase, roomId: string, checkIn: ISODate, checkOut: ISODate, excludeId?: string) {
  return db.reservations.filter(
    (r) => r.roomId === roomId && r.id !== excludeId && ROOM_HOLDING_STATUSES.includes(r.status) && staysOverlap(r, checkIn, checkOut),
  )
}

// ------------------------------------------------------------------ queries

function list(query: ReservationListQuery = {}) {
  const db = getDatabase()
  const guests = new Map(db.guests.map((g) => [g.id, g]))
  const { status, source, from, to } = query
  return applyListQuery(
    db.reservations.map((r) => toReservationSummary(db, r)),
    query,
    {
      searchFields: (s) => [s.id, s.guestName, guests.get(s.guestId)?.email, guests.get(s.guestId)?.phone, s.roomNumber, enumLabel(s.roomType)],
      // A stay matches a date range when it is in the hotel at any point of it, arrival and departure days included.
      filter: (s) =>
        (!status || s.status === status) &&
        (!source || s.source === source) &&
        (!from || s.checkOut >= from) &&
        (!to || s.checkIn <= to),
      sortAccessors: {
        roomNumber: (s) => Number(s.roomNumber),
        status: (s) => BOOKING_STATUSES.indexOf(s.status),
      },
      defaultSort: (a, b) => b.checkIn.localeCompare(a.checkIn) || b.createdAt.localeCompare(a.createdAt),
    },
  )
}

function details(id: string): ReservationDetails {
  const reservation = reservations.get(id)
  const db = getDatabase()
  const room = db.rooms.find((r) => r.id === reservation.roomId)
  const guest = db.guests.find((g) => g.id === reservation.guestId)
  const payments = db.payments
    .filter((p) => p.reservationId === id)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
  return {
    ...toReservationSummary(db, reservation),
    roomRate: reservation.roomRate,
    roomFloor: room?.floor ?? 0,
    roomCapacity: room?.capacity ?? 0,
    guestEmail: guest?.email ?? '',
    guestPhone: guest?.phone ?? '',
    quote: quoteStay(reservation.roomRate, reservation.checkIn, reservation.checkOut, slabs(db)),
    payments,
    amountPaid: completedRevenue(payments),
  }
}

function validateAvailabilityQuery({ checkIn, checkOut, guests, excludeReservationId }: AvailabilityQuery, db: MockDatabase) {
  const fieldErrors: Record<string, string> = {}
  const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '')
  const excluded = excludeReservationId ? db.reservations.find((r) => r.id === excludeReservationId) : undefined
  const today = todayISO()
  const earliest = excluded && excluded.checkIn < today ? excluded.checkIn : today
  if (!valid(checkIn)) fieldErrors.checkIn = 'Select the check-in date'
  else if (checkIn < earliest) fieldErrors.checkIn = 'Check-in cannot be in the past'
  if (!valid(checkOut)) fieldErrors.checkOut = 'Select the check-out date'
  else if (valid(checkIn)) {
    const nights = diffDays(checkIn, checkOut)
    if (nights < 1) fieldErrors.checkOut = 'Check-out must be after check-in'
    else if (nights > MAX_NIGHTS) fieldErrors.checkOut = `A booking can cover at most ${MAX_NIGHTS} nights`
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) fieldErrors.guests = `Enter 1–${MAX_GUESTS} guests`
  if (Object.keys(fieldErrors).length) throw new ApiError(400, 'Validation failed', fieldErrors)
  return excluded
}

function availability(query: AvailabilityQuery): AvailableRoom[] {
  const db = getDatabase()
  const excluded = validateAvailabilityQuery(query, db)
  const { checkIn, checkOut, guests, type } = query
  return db.rooms
    .filter(
      (room) =>
        room.status !== 'MAINTENANCE' &&
        room.capacity >= guests &&
        (!type || room.type === type) &&
        conflicts(db, room.id, checkIn, checkOut, excluded?.id).length === 0,
    )
    .sort(
      (a, b) =>
        ROOM_TYPES.indexOf(a.type) - ROOM_TYPES.indexOf(b.type) ||
        a.pricePerNight - b.pricePerNight ||
        a.roomNumber.localeCompare(b.roomNumber, 'en', { numeric: true }),
    )
    .map((room) => {
      // The booking being edited keeps its locked-in rate for its own room.
      const rate = excluded && excluded.roomId === room.id ? excluded.roomRate : room.pricePerNight
      return { room, quote: quoteStay(rate, checkIn, checkOut, slabs(db)) }
    })
}

// ------------------------------------------------------------------ commands

/** Business checks beyond the schema. Returns the room being booked. */
function assertBookable(db: MockDatabase, input: ReservationInput, excludeId?: string): Room {
  if (!db.guests.some((g) => g.id === input.guestId)) {
    throw new ApiError(400, 'Validation failed', { guestId: 'Select an existing guest' })
  }
  const room = db.rooms.find((r) => r.id === input.roomId)
  if (!room) throw new ApiError(400, 'Validation failed', { roomId: 'Select an existing room' })
  if (room.status === 'MAINTENANCE') {
    const message = `Room ${room.roomNumber} is under maintenance and cannot be booked`
    throw new ApiError(409, message, { roomId: message })
  }
  if (input.numberOfGuests > room.capacity) {
    const message = `Room ${room.roomNumber} sleeps at most ${room.capacity} guest${room.capacity > 1 ? 's' : ''}`
    throw new ApiError(400, 'Validation failed', { numberOfGuests: message })
  }
  const clash = conflicts(db, room.id, input.checkIn, input.checkOut, excludeId)[0]
  if (clash) {
    const message = `Room ${room.roomNumber} is already booked ${formatShortDate(clash.checkIn)} – ${formatShortDate(clash.checkOut)} (${clash.id})`
    throw new ApiError(409, message, { roomId: message })
  }
  return room
}

function create(raw: ReservationInput): ReservationSummary {
  const today = todayISO()
  const input = parseOrThrow(reservationInputSchema({ earliestCheckIn: today }), raw)
  const room = assertBookable(getDatabase(), input)
  return mutateDatabase((draft) => {
    const reservation: Reservation = {
      ...input,
      id: nextId(draft.reservations.map((r) => r.id), 'BK'),
      roomRate: room.pricePerNight,
      createdAt: nowISODateTime(),
    }
    draft.reservations.push(reservation)
    syncRoomStatus(draft, reservation.roomId, today)
    return toReservationSummary(draft, reservation)
  })
}

function assertEditable(reservation: Reservation, action: 'edited' | 'cancelled') {
  if (isEditable(reservation)) return
  const reason: Record<string, string> = {
    CHECKED_IN: action === 'cancelled' ? 'The guest is in-house; check them out instead.' : 'Changes to an in-house stay are made at the front desk.',
    CHECKED_OUT: 'The stay is complete.',
    CANCELLED: 'It is already cancelled.',
  }
  throw new ApiError(409, `${reservation.id} is ${enumLabel(reservation.status).toLowerCase()} and cannot be ${action}. ${reason[reservation.status] ?? ''}`.trim())
}

function update(id: string, raw: ReservationInput): ReservationSummary {
  const existing = reservations.get(id)
  assertEditable(existing, 'edited')
  const today = todayISO()
  const earliestCheckIn = existing.checkIn < today ? existing.checkIn : today
  const input = parseOrThrow(reservationInputSchema({ earliestCheckIn }), raw)
  const room = assertBookable(getDatabase(), input, id)
  return mutateDatabase((draft) => {
    const index = draft.reservations.findIndex((r) => r.id === id)
    const updated: Reservation = {
      ...existing,
      ...input,
      roomRate: input.roomId === existing.roomId ? existing.roomRate : room.pricePerNight,
    }
    draft.reservations[index] = updated
    syncRoomStatus(draft, existing.roomId, today)
    syncRoomStatus(draft, updated.roomId, today)
    return toReservationSummary(draft, updated)
  })
}

function cancel(id: string): ReservationSummary {
  const existing = reservations.get(id)
  assertEditable(existing, 'cancelled')
  return mutateDatabase((draft) => {
    const reservation = draft.reservations.find((r) => r.id === id)!
    reservation.status = 'CANCELLED'
    syncRoomStatus(draft, reservation.roomId, todayISO())
    return toReservationSummary(draft, reservation)
  })
}

export const mockReservationService: ReservationService = {
  list: (query) => mockCall(() => list(query)),
  get: (id) => mockCall(() => details(id)),
  availability: (query) => mockCall(() => availability(query)),
  create: (input) => mockCall(() => create(input)),
  update: (id, input) => mockCall(() => update(id, input)),
  cancel: (id) => mockCall(() => cancel(id)),
}
