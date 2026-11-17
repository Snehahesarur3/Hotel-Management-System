import type { ListQuery } from './api'
import type { HousekeepingTaskSummary } from './dashboard'
import type { HousekeepingTask, ISODate } from './domain'
import type { Department, HousekeepingStatus, HousekeepingTaskType, RoomStatus, TaskPriority } from './enums'

/** Departments whose active staff can be assigned housekeeping tasks (maintenance handles inspections and deep cleans too). */
export const HOUSEKEEPING_DEPARTMENTS = ['HOUSEKEEPING', 'MAINTENANCE'] as const satisfies readonly Department[]

/** Task types that make a room unavailable until they are done (finishing the last one frees a room in Cleaning). */
export const CLEANING_TASK_TYPES = ['CHECKOUT_CLEAN', 'DEEP_CLEAN'] as const satisfies readonly HousekeepingTaskType[]

/** Task row as returned by GET /api/housekeeping/tasks. */
export interface HousekeepingTaskView extends HousekeepingTaskSummary {
  roomId: string
  floor: number
  roomStatus: RoomStatus
  assignedStaffId: string
  notes?: string
  completedAt?: string
}

export type HousekeepingSortField = 'scheduledDate' | 'roomNumber' | 'priority' | 'status' | 'taskType' | 'assignee'

export interface HousekeepingFilters {
  /** Scheduled date (exact); omit for all dates. */
  date?: ISODate
  status?: HousekeepingStatus
  floor?: number
  staffId?: string
  taskType?: HousekeepingTaskType
  priority?: TaskPriority
}

/** GET /api/housekeeping/tasks?date=&status=&floor=&staffId=&taskType=&priority=&search=&page=&size=&sort= */
export type HousekeepingListQuery = ListQuery<HousekeepingSortField> & HousekeepingFilters

/** Body of POST /api/housekeeping/tasks and PUT /api/housekeeping/tasks/{id}. */
export type HousekeepingTaskInput = Pick<HousekeepingTask, 'roomId' | 'assignedStaffId' | 'taskType' | 'priority' | 'scheduledDate'> & {
  notes?: string
}

export interface StaffWorkload {
  staffId: string
  fullName: string
  department: Department
  /** Pending + in-progress tasks on the date. */
  open: number
  completed: number
}

/** GET /api/housekeeping/summary?date= */
export interface HousekeepingSummary {
  date: ISODate
  pending: number
  inProgress: number
  completed: number
  /** Rooms currently in Cleaning status (they cannot be let until a clean is completed). */
  roomsToClean: number
  /** Every assignable staff member with their load on the date, least busy first. */
  staff: StaffWorkload[]
}

/** Allowed manual transitions. Completed tasks are final. */
export const TASK_TRANSITIONS: Record<HousekeepingStatus, readonly HousekeepingStatus[]> = {
  PENDING: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED', 'PENDING'],
  COMPLETED: [],
}
