import type { FrontDeskService } from '@/api/types'
import { calculateStayBill } from '@/mock/calculations/billing'
import { toReservationSummary } from '@/mock/calculations/dashboard'
import { nextId } from '@/mock/collection'
import { getDatabase, mutateDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import { mockPaymentGateway } from '@/mock/payments/mockPaymentGateway'
import { arrivalToday, ROOM_HOLDING_STATUSES, staysOverlap, syncRoomStatus } from '@/mock/rules/roomStatus'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { checkInSchema, checkOutSchema } from '@/schemas/frontDesk'
import { ApiError } from '@/types/api'
import type { HousekeepingTask, ISODate, Payment, Reservation, Room } from '@/types/domain'
import { ROOM_TYPES } from '@/types/enums'
import {
  canCheckIn,
  type CheckInInput,
  type CheckInPreview,
  type CheckInRoomOption,
  type CheckOutInput,
  type CheckOutResult,
  type FrontDeskOverview,
} from '@/types/frontDesk'
import { nowISODateTime, todayISO } from '@/utils/date'
import { enumLabel, formatCurrency, formatDate } from '@/utils/format'

/**
 * Mock implementation of /api/front-desk: arrivals, check-in and check-out.
 *
 * Check-in
 * - only pending/confirmed bookings, from the arrival date until the day before departure
 *   (late arrivals are allowed; the booked nights are still charged);
 * - the guest's ID is verified: the last 4 characters read from the document must match the masked number on file;
 * - the room must be ready (Available, or Reserved for this arrival), fit the party and be free for the remaining nights.
 *   Moving the guest to another room keeps the booked rate. The room becomes Occupied.
 *
 * Check-out
 * - only checked-in stays; the departure date becomes today, so early and late check-outs are billed for the nights
 *   actually used (a same-day stay is billed as one night);
 * - any balance must be settled in the same request through the (mock) payment gateway;
 * - the room goes to Cleaning and a checkout-clean task is assigned to the least busy housekeeper.
 */

const byRoomNumber = (a: { roomNumber: string }, b: { roomNumber: string }) =>
  a.roomNumber.localeCompare(b.roomNumber, 'en', { numeric: true })

function findReservation(db: MockDatabase, id: string): Reservation {
  const reservation = db.reservations.find((r) => r.id === id)
  if (!reservation) throw new ApiError(404, `Reservation with id '${id}' was not found`)
  return reservation
}

// ------------------------------------------------------------------ overview

function overview(): FrontDeskOverview {
  const db = getDatabase()
  const today = todayISO()
  const summaries = (list: Reservation[]) => list.map((r) => toReservationSummary(db, r))
  const inHouse = db.reservations.filter((r) => r.status === 'CHECKED_IN')
  return {
    date: today,
    arrivals: summaries(
      db.reservations
        .filter((r) => canCheckIn(r, today))
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.createdAt.localeCompare(b.createdAt)),
    ),
    inHouse: summaries(inHouse).sort(byRoomNumber),
    departures: summaries(inHouse.filter((r) => r.checkOut <= today)).sort(
      (a, b) => a.checkOut.localeCompare(b.checkOut) || byRoomNumber(a, b),
    ),
  }
}

// ------------------------------------------------------------------ check-in

function assertCanCheckIn(reservation: Reservation, today: ISODate) {
  if (canCheckIn(reservation, today)) return
  const { id, status, checkIn, checkOut } = reservation
  if (status !== 'PENDING' && status !== 'CONFIRMED') {
    throw new ApiError(409, `${id} is ${enumLabel(status).toLowerCase()} and cannot be checked in`)
  }
  if (checkIn > today) {
    throw new ApiError(409, `${id} arrives on ${formatDate(checkIn)}. Check-in opens on the arrival date.`)
  }
  throw new ApiError(409, `${id} was due to leave on ${formatDate(checkOut)}. Cancel the booking or change its dates first.`)
}

/** Why a room cannot be handed over now, or null when it can. */
function roomBlocker(db: MockDatabase, room: Room, reservation: Reservation, today: ISODate): string | null {
  if (room.status === 'MAINTENANCE') return 'Under maintenance'
  if (room.capacity < reservation.numberOfGuests) return `Sleeps at most ${room.capacity}`
  const from = reservation.checkIn > today ? reservation.checkIn : today
  const clash = db.reservations.find(
    (r) =>
      r.roomId === room.id &&
      r.id !== reservation.id &&
      ROOM_HOLDING_STATUSES.includes(r.status) &&
      staysOverlap(r, from, reservation.checkOut),
  )
  if (clash) return clash.status === 'CHECKED_IN' ? 'Previous guest has not checked out' : `Booked for ${clash.id}`
  if (room.status === 'OCCUPIED') return 'Previous guest has not checked out'
  if (room.status === 'CLEANING') return 'Being cleaned'
  return null
}

function checkInPreview(id: string): CheckInPreview {
  const db = getDatabase()
  const today = todayISO()
  const reservation = findReservation(db, id)
  assertCanCheckIn(reservation, today)
  const guest = db.guests.find((g) => g.id === reservation.guestId)
  const booked = db.rooms.find((r) => r.id === reservation.roomId)
  const bookedType = booked ? ROOM_TYPES.indexOf(booked.type) : 0

  const option = (room: Room): CheckInRoomOption => {
    const reason = roomBlocker(db, room, reservation, today)
    return { room, booked: room.id === reservation.roomId, ready: reason === null, ...(reason ? { reason } : {}) }
  }
  const alternatives = db.rooms
    .filter((r) => r.id !== reservation.roomId)
    .map(option)
    .filter((o) => o.ready)
    // Same category first, then upgrades, then the rest; cheapest first within a category.
    .sort((a, b) => {
      const rank = (room: Room) => {
        const diff = ROOM_TYPES.indexOf(room.type) - bookedType
        return diff === 0 ? 0 : diff > 0 ? diff : 10 - diff
      }
      return rank(a.room) - rank(b.room) || a.room.pricePerNight - b.room.pricePerNight || byRoomNumber(a.room, b.room)
    })

  return {
    reservation: toReservationSummary(db, reservation),
    idProofType: guest?.idProofType ?? 'PASSPORT',
    lateArrival: reservation.checkIn < today,
    rooms: [...(booked ? [option(booked)] : []), ...alternatives],
  }
}

function checkIn(id: string, raw: CheckInInput) {
  const db = getDatabase()
  const today = todayISO()
  const reservation = findReservation(db, id)
  assertCanCheckIn(reservation, today)
  const input = parseOrThrow(checkInSchema, raw)

  const guest = db.guests.find((g) => g.id === reservation.guestId)
  if (!guest || guest.idProofNumber.slice(-4).toUpperCase() !== input.idLast4) {
    // Never echo the stored digits back: the check only works if staff read them off the document.
    const message = `Doesn't match the ${enumLabel(guest?.idProofType ?? 'PASSPORT')} on file. Check the document again.`
    throw new ApiError(400, 'Identity check failed', { idLast4: message })
  }

  const room = db.rooms.find((r) => r.id === input.roomId)
  if (!room) throw new ApiError(400, 'Validation failed', { roomId: 'Choose an existing room' })
  const blocker = roomBlocker(db, room, reservation, today)
  if (blocker) {
    const message = `Room ${room.roomNumber} can't be assigned: ${blocker.charAt(0).toLowerCase()}${blocker.slice(1)}`
    throw new ApiError(409, message, { roomId: message })
  }

  return mutateDatabase((draft) => {
    const stay = draft.reservations.find((r) => r.id === id)!
    const previousRoomId = stay.roomId
    stay.roomId = room.id // the booked rate is kept, even on a move
    stay.status = 'CHECKED_IN'
    stay.checkedInAt = nowISODateTime()
    draft.rooms.find((r) => r.id === room.id)!.status = 'OCCUPIED'
    if (previousRoomId !== room.id) syncRoomStatus(draft, previousRoomId, today)
    return toReservationSummary(draft, stay)
  })
}

// ------------------------------------------------------------------ check-out

/** Early and late check-outs are billed for the nights actually used (the bill applies a one-night minimum). */
function finalCheckOut(_reservation: Reservation, today: ISODate): ISODate {
  return today
}

function assertCheckedIn(reservation: Reservation) {
  if (reservation.status !== 'CHECKED_IN') {
    throw new ApiError(409, `${reservation.id} is ${enumLabel(reservation.status).toLowerCase()}; only checked-in stays can be checked out`)
  }
}

function checkOutPreview(id: string) {
  const db = getDatabase()
  const reservation = findReservation(db, id)
  assertCheckedIn(reservation)
  return calculateStayBill(db, reservation, finalCheckOut(reservation, todayISO()))
}

/** Least busy active housekeeper today (fewest open tasks), ties by id. */
function pickHousekeeper(db: MockDatabase, today: ISODate): string {
  const housekeepers = db.staff.filter((s) => s.department === 'HOUSEKEEPING' && s.employmentStatus === 'ACTIVE')
  const load = (staffId: string) =>
    db.housekeepingTasks.filter((t) => t.assignedStaffId === staffId && t.scheduledDate === today && t.status !== 'COMPLETED').length
  return [...housekeepers].sort((a, b) => load(a.id) - load(b.id) || a.id.localeCompare(b.id))[0]?.id ?? ''
}

function checkOut(id: string, raw: CheckOutInput = {}): CheckOutResult {
  const db = getDatabase()
  const today = todayISO()
  const reservation = findReservation(db, id)
  assertCheckedIn(reservation)
  const { paymentMethod } = parseOrThrow(checkOutSchema, raw)
  const departure = finalCheckOut(reservation, today)
  const bill = calculateStayBill(db, reservation, departure)

  let settlement: Payment | null = null
  if (bill.balance > 0) {
    if (!paymentMethod) {
      const message = `Collect the outstanding ${formatCurrency(bill.balance)} before check-out`
      throw new ApiError(409, message, { paymentMethod: 'Choose how the guest is paying' })
    }
    const result = mockPaymentGateway.charge({ amount: bill.balance, method: paymentMethod, reference: reservation.id })
    if (!result.approved) throw new ApiError(402, `Payment declined: ${result.declineReason}`)
    settlement = {
      id: nextId(db.payments.map((p) => p.id), 'PAY'),
      reservationId: reservation.id,
      amount: bill.balance,
      method: paymentMethod,
      paymentDate: nowISODateTime(),
      status: 'COMPLETED',
      transactionReference: result.transactionReference,
    }
  }

  return mutateDatabase((draft) => {
    const stay = draft.reservations.find((r) => r.id === id)!
    stay.status = 'CHECKED_OUT'
    stay.checkOut = departure
    stay.checkedOutAt = nowISODateTime()
    if (settlement) draft.payments.push(settlement)

    const room = draft.rooms.find((r) => r.id === stay.roomId)
    if (room) room.status = 'CLEANING'
    const task: HousekeepingTask = {
      id: nextId(draft.housekeepingTasks.map((t) => t.id), 'HK'),
      roomId: stay.roomId,
      assignedStaffId: pickHousekeeper(draft, today),
      taskType: 'CHECKOUT_CLEAN',
      // Rush the clean when someone is arriving in this room today.
      priority: arrivalToday(draft, stay.roomId, today) ? 'HIGH' : 'NORMAL',
      status: 'PENDING',
      scheduledDate: today,
      notes: `Checkout clean after ${stay.id}`,
    }
    draft.housekeepingTasks.push(task)

    return {
      reservation: toReservationSummary(draft, stay),
      bill: calculateStayBill(draft, stay),
      payment: settlement,
      housekeepingTaskId: task.id,
    }
  })
}

export const mockFrontDeskService: FrontDeskService = {
  overview: () => mockCall(overview),
  checkInPreview: (id) => mockCall(() => checkInPreview(id)),
  checkIn: (id, input) => mockCall(() => checkIn(id, input)),
  checkOutPreview: (id) => mockCall(() => checkOutPreview(id)),
  checkOut: (id, input) => mockCall(() => checkOut(id, input)),
}
