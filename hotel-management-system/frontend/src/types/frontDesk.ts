import type { ReservationSummary } from './dashboard'
import type { StayBill } from './billing'
import type { ISODate, Payment, Room } from './domain'
import type { BookingStatus, IdProofType, PaymentMethod } from './enums'

export type { BillLine, BillOrder, StayBill } from './billing'

/** GET /api/front-desk/overview: the front desk's working lists for today. */
export interface FrontDeskOverview {
  date: ISODate
  /** Pending/confirmed stays that can be checked in today (includes late arrivals), earliest first. */
  arrivals: ReservationSummary[]
  /** Every checked-in stay, by room number. */
  inHouse: ReservationSummary[]
  /** Checked-in stays due out today or overdue. */
  departures: ReservationSummary[]
}

export interface CheckInRoomOption {
  room: Room
  /** The room on the booking. */
  booked: boolean
  /** Clean, free and not under maintenance: a guest can be given the key now. */
  ready: boolean
  /** Why the room cannot be used right now, when not ready. */
  reason?: string
}

/** GET /api/front-desk/check-in/{reservationId} */
export interface CheckInPreview {
  reservation: ReservationSummary
  /** Document type on file. The number itself is never sent to the front desk. */
  idProofType: IdProofType
  /** Check-in date has passed (the booked nights are still charged). */
  lateArrival: boolean
  /** The booked room first, then other ready rooms that fit the party for the remaining nights. */
  rooms: CheckInRoomOption[]
}

/** POST /api/front-desk/check-in/{reservationId} */
export interface CheckInInput {
  roomId: string
  /** Last 4 characters read from the guest's physical ID document, compared with the masked number on file. */
  idLast4: string
}

/** POST /api/front-desk/check-out/{reservationId} */
export interface CheckOutInput {
  /** Required when a balance is due: how the guest settles it (processed by the mock gateway). */
  paymentMethod?: PaymentMethod
}

export interface CheckOutResult {
  reservation: ReservationSummary
  bill: StayBill
  /** Settlement payment recorded at check-out, if a balance was due. */
  payment: Payment | null
  /** Checkout-clean task created for the room. */
  housekeepingTaskId: string
}

/** A pending/confirmed booking can be checked in from its arrival date until the day before departure. */
export function canCheckIn(r: { status: BookingStatus; checkIn: ISODate; checkOut: ISODate }, today: ISODate): boolean {
  return (r.status === 'PENDING' || r.status === 'CONFIRMED') && r.checkIn <= today && r.checkOut > today
}

export function canCheckOut(r: { status: BookingStatus }): boolean {
  return r.status === 'CHECKED_IN'
}
