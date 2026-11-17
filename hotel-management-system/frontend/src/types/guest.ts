import type { ListQuery } from './api'
import type { ReservationSummary } from './dashboard'
import type { Guest, ISODate } from './domain'
import type { IdProofType } from './enums'

/**
 * Body of POST /api/guests and PUT /api/guests/{id}.
 * `idProofNumber` is the full number as typed; the API stores only a masked form (last 4 characters).
 * On update, omit it (or send an empty string) to keep the stored value.
 */
export interface GuestInput {
  fullName: string
  email: string
  phone: string
  address: string
  nationality: string
  idProofType: IdProofType
  idProofNumber?: string
}

/** Guest as returned by the API: stored fields plus values derived from reservations. */
export interface GuestSummary extends Guest {
  /** Completed (checked-out) stays. */
  previousBookingCount: number
  /** Check-in date of the most recent non-cancelled reservation, if any. */
  lastStay: ISODate | null
}

export type GuestSortField = 'fullName' | 'nationality' | 'registrationDate' | 'previousBookingCount' | 'lastStay'

export interface GuestFilters {
  nationality?: string
}

/** GET /api/guests?search=&nationality=&page=&size=&sort= */
export type GuestListQuery = ListQuery<GuestSortField> & GuestFilters

export interface GuestStats {
  totalReservations: number
  completedStays: number
  upcomingStays: number
  cancelled: number
  nightsStayed: number
  /** Sum of completed payments on the guest's reservations. */
  totalSpent: number
}

/** GET /api/guests/{id}/history */
export interface GuestHistory {
  stats: GuestStats
  /** Every reservation of the guest, most recent check-in first. */
  reservations: ReservationSummary[]
}

export type { IdProofType }
