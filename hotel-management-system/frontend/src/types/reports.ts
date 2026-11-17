import type { PaymentRecord } from './billing'
import type { ReservationSummary } from './dashboard'
import type { ISODate } from './domain'
import type { BookingSource, BookingStatus, PaymentMethod, PaymentStatus, RoomType } from './enums'

/**
 * Response shapes of GET /api/reports/*. Every report covers an inclusive date range;
 * the date each report filters on is stated on its type.
 */

export const REPORT_GROUPINGS = ['DAY', 'MONTH', 'YEAR'] as const
export type ReportGrouping = (typeof REPORT_GROUPINGS)[number]

/** Inclusive yyyy-MM-dd range (query parameters `from` and `to`). */
export interface ReportRange {
  from: ISODate
  to: ISODate
}

/** GET /api/reports/revenue?from=&to=&groupBy= */
export interface RevenueReportQuery extends ReportRange {
  groupBy: ReportGrouping
}

// ------------------------------------------------------------------ revenue

export interface RevenuePeriod {
  /** yyyy-MM-dd (DAY), yyyy-MM (MONTH) or yyyy (YEAR). */
  period: string
  /** Completed incoming payments. */
  collected: number
  /** Completed refunds, as a positive amount. */
  refunded: number
  /** collected - refunded */
  net: number
  /** Number of completed payments and refunds. */
  transactions: number
}

export interface RevenueShare<K extends string> {
  key: K
  net: number
  transactions: number
  /** Share of total net revenue, percent with one decimal. */
  share: number
}

/** Folio charges of stays that checked out in the range (accrual view, before payments). */
export interface ChargesBreakdown {
  stays: number
  roomCharges: number
  discounts: number
  foodCharges: number
  extraCharges: number
  tax: number
  /** roomCharges - discounts + foodCharges + extraCharges + tax */
  total: number
}

/** Cash view: completed payments by payment date. */
export interface RevenueReport extends RevenueReportQuery {
  totals: {
    collected: number
    refunded: number
    net: number
    transactions: number
    /** net / days in range */
    averagePerDay: number
  }
  /** Every period that overlaps the range, oldest first (zero-revenue periods included). */
  periods: RevenuePeriod[]
  bySource: RevenueShare<BookingSource>[]
  byRoomType: RevenueShare<RoomType>[]
  charges: ChargesBreakdown
}

// ------------------------------------------------------------------ occupancy

export interface OccupancyNight {
  date: ISODate
  occupiedRooms: number
  totalRooms: number
  /** Percent, one decimal. */
  rate: number
  /** Sum of the nightly rates of the rooms sold that night. */
  roomRevenue: number
  /** Tonight or later: counts confirmed and pending bookings ("on the books"). */
  forecast: boolean
}

export interface RoomTypePerformance {
  type: RoomType
  rooms: number
  roomNightsAvailable: number
  roomNightsSold: number
  occupancyRate: number
  roomRevenue: number
  /** Average daily rate: roomRevenue / roomNightsSold. */
  averageDailyRate: number
  /** Revenue per available room night: roomRevenue / roomNightsAvailable. */
  revPar: number
}

export interface RoomPerformance {
  roomId: string
  roomNumber: string
  type: RoomType
  floor: number
  stays: number
  nightsSold: number
  occupancyRate: number
  roomRevenue: number
  averageDailyRate: number
}

/**
 * Night-by-night occupancy (a night belongs to its start date).
 * Past nights count stays that happened (checked in or out); tonight onwards also counts confirmed and pending bookings.
 */
export interface OccupancyReport extends ReportRange {
  totals: {
    nights: number
    roomNightsAvailable: number
    roomNightsSold: number
    occupancyRate: number
    roomRevenue: number
    averageDailyRate: number
    revPar: number
    /** First forecast night in the range, or null when the range is entirely in the past. */
    forecastFrom: ISODate | null
  }
  nights: OccupancyNight[]
  byRoomType: RoomTypePerformance[]
  /** Every room, best performing (most nights sold) first. */
  rooms: RoomPerformance[]
}

// ------------------------------------------------------------------ reservations

export interface ReservationSourceRow {
  key: BookingSource
  reservations: number
  cancelled: number
  /** Non-cancelled bookings only. */
  roomNights: number
  roomRevenue: number
}

export interface ReservationRoomTypeRow {
  key: RoomType
  reservations: number
  roomNights: number
  roomRevenue: number
}

/** Reservations arriving (check-in date) in the range, including cancelled ones. */
export interface ReservationReport extends ReportRange {
  totals: {
    reservations: number
    cancelled: number
    /** Percent of reservations, one decimal. */
    cancellationRate: number
    /** The figures below exclude cancelled bookings. */
    roomNights: number
    roomRevenue: number
    /** Average nights per stay, one decimal. */
    averageStay: number
    /** Average days between booking and arrival, one decimal. */
    averageLeadTime: number
    /** Average party size, one decimal. */
    averageGuests: number
  }
  byStatus: { key: BookingStatus; count: number }[]
  bySource: ReservationSourceRow[]
  byRoomType: ReservationRoomTypeRow[]
  /** Arrival order. */
  rows: ReservationSummary[]
}

// ------------------------------------------------------------------ guests

export interface GuestReportRow {
  guestId: string
  guestName: string
  nationality: string
  stays: number
  nights: number
  roomRevenue: number
  lastArrival: ISODate
  /** Registered in the range. */
  isNew: boolean
  /** Had an earlier (non-cancelled) stay arriving before the range. */
  isReturning: boolean
}

export interface NationalityRow {
  key: string
  guests: number
  stays: number
  nights: number
  roomRevenue: number
}

/** Guests with a non-cancelled stay arriving in the range. */
export interface GuestReport extends ReportRange {
  totals: {
    guests: number
    newGuests: number
    returningGuests: number
    stays: number
    roomRevenue: number
    /** roomRevenue / guests */
    averageRevenuePerGuest: number
  }
  /** Most guests first. */
  byNationality: NationalityRow[]
  /** Highest room revenue first. */
  guests: GuestReportRow[]
}

// ------------------------------------------------------------------ payments

export interface PaymentMethodRow {
  key: PaymentMethod
  /** Completed transactions (payments and refunds). */
  transactions: number
  collected: number
  refunded: number
  net: number
  /** Share of total net, percent with one decimal. */
  share: number
}

export interface PaymentStatusRow {
  key: PaymentStatus
  count: number
  amount: number
}

/** Every payment and refund dated in the range, whatever its status. */
export interface PaymentReport extends ReportRange {
  totals: {
    transactions: number
    collected: number
    refunded: number
    net: number
    pendingCount: number
    pendingAmount: number
    failedCount: number
    failedAmount: number
  }
  byMethod: PaymentMethodRow[]
  byStatus: PaymentStatusRow[]
  /** Newest first. */
  rows: PaymentRecord[]
}
