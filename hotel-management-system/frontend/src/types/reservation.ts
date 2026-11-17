import type { ListQuery } from './api'
import type { ReservationSummary } from './dashboard'
import type { ISODate, Payment, Room } from './domain'
import type { BookingSource, BookingStatus, RoomType } from './enums'

/** Statuses a booking can be created or edited into. Check-in/out and cancellation have their own actions. */
export const BOOKABLE_STATUSES = ['PENDING', 'CONFIRMED'] as const satisfies readonly BookingStatus[]
export type BookableStatus = (typeof BOOKABLE_STATUSES)[number]

/** Only pending and confirmed bookings can be edited or cancelled. */
export function isEditableBooking(r: { status: BookingStatus }): boolean {
  return (BOOKABLE_STATUSES as readonly BookingStatus[]).includes(r.status)
}

/**
 * Body of POST /api/reservations and PUT /api/reservations/{id}.
 * The nightly rate is not sent: the API locks in the room's current tariff when the booking is
 * created (or moved to another room) and keeps it on date changes.
 */
export interface ReservationInput {
  guestId: string
  roomId: string
  checkIn: ISODate
  checkOut: ISODate
  numberOfGuests: number
  source: BookingSource
  status: BookableStatus
}

/** Room charges for a stay. GST follows the hotel's slab for the nightly rate. */
export interface StayQuote {
  nights: number
  roomRate: number
  /** roomRate x nights */
  roomCharges: number
  gstPercent: number
  gstAmount: number
  /** roomCharges + gstAmount (restaurant and other extras are billed separately). */
  total: number
}

/** GET /api/reservations/availability?checkIn=&checkOut=&guests=&type=&excludeReservationId= */
export interface AvailabilityQuery {
  checkIn: ISODate
  checkOut: ISODate
  guests: number
  type?: RoomType
  /** When editing: ignore this booking so its own room shows as free. */
  excludeReservationId?: string
}

export interface AvailableRoom {
  room: Room
  quote: StayQuote
}

export type ReservationSortField = 'checkIn' | 'checkOut' | 'createdAt' | 'guestName' | 'roomNumber' | 'totalAmount' | 'status'

export interface ReservationFilters {
  status?: BookingStatus
  source?: BookingSource
  /** Stays overlapping [from, to] (inclusive dates). */
  from?: ISODate
  to?: ISODate
}

/** GET /api/reservations?search=&status=&source=&from=&to=&page=&size=&sort= */
export type ReservationListQuery = ListQuery<ReservationSortField> & ReservationFilters

/** GET /api/reservations/{id} */
export interface ReservationDetails extends ReservationSummary {
  roomRate: number
  roomFloor: number
  roomCapacity: number
  guestEmail: string
  guestPhone: string
  quote: StayQuote
  /** Payments recorded against the booking, newest first. */
  payments: Payment[]
  /** Sum of completed payments. */
  amountPaid: number
}
