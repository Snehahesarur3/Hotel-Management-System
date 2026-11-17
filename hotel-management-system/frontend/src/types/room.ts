import type { ListQuery } from './api'
import type { HousekeepingTaskSummary, ReservationSummary } from './dashboard'
import type { Room } from './domain'
import type { RoomStatus, RoomType } from './enums'

/** Body of POST /api/rooms and PUT /api/rooms/{id}. */
export type RoomInput = Omit<Room, 'id'>

export type RoomSortField = 'roomNumber' | 'floor' | 'type' | 'capacity' | 'pricePerNight' | 'status'

export interface RoomFilters {
  floor?: number
  type?: RoomType
  status?: RoomStatus
}

/** GET /api/rooms?search=&floor=&type=&status=&page=&size=&sort= */
export type RoomListQuery = ListQuery<RoomSortField> & RoomFilters

/** GET /api/rooms/{id}/activity: what is happening in and around a room. */
export interface RoomActivity {
  /** The checked-in stay, if a guest is in-house. */
  currentStay: ReservationSummary | null
  /** Pending/confirmed stays that have not started, soonest first. */
  upcoming: ReservationSummary[]
  /** Checked-out and cancelled stays, most recent first. */
  history: ReservationSummary[]
  /** Housekeeping tasks for the room, open ones first. */
  housekeeping: HousekeepingTaskSummary[]
}
