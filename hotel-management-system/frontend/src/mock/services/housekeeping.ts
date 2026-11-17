import type { HousekeepingService } from '@/api/types'
import { PRIORITY_ORDER, toTaskSummary } from '@/mock/calculations/dashboard'
import { applyListQuery, nextId } from '@/mock/collection'
import { getDatabase, mutateDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import { releaseRoomIfClean } from '@/mock/rules/roomStatus'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { housekeepingTaskSchema } from '@/schemas/housekeeping'
import { ApiError } from '@/types/api'
import type { HousekeepingTask, ISODate } from '@/types/domain'
import { HOUSEKEEPING_STATUSES, HOUSEKEEPING_TASK_TYPES, type HousekeepingStatus } from '@/types/enums'
import {
  HOUSEKEEPING_DEPARTMENTS,
  TASK_TRANSITIONS,
  type HousekeepingListQuery,
  type HousekeepingSummary,
  type HousekeepingTaskInput,
  type HousekeepingTaskView,
} from '@/types/housekeeping'
import { nowISODateTime, todayISO } from '@/utils/date'
import { enumLabel, formatDate } from '@/utils/format'

/**
 * Mock implementation of /api/housekeeping.
 * - Tasks go Pending -> In progress -> Completed (an in-progress task can be paused back to Pending); completed tasks are final.
 * - Only active housekeeping or maintenance staff can be assigned.
 * - A room cannot have two open tasks of the same type on the same day.
 * - Completing the last open checkout/deep clean of a room in Cleaning frees it: Available, or Reserved for today's arrival.
 * - Only pending tasks can be deleted (started or finished work stays on record).
 */

const STATUS_ORDER: Record<HousekeepingStatus, number> = { IN_PROGRESS: 0, PENDING: 1, COMPLETED: 2 }

function findTask(db: MockDatabase, id: string): HousekeepingTask {
  const task = db.housekeepingTasks.find((t) => t.id === id)
  if (!task) throw new ApiError(404, `Housekeeping task with id '${id}' was not found`)
  return task
}

function assignableStaff(db: MockDatabase) {
  return db.staff.filter(
    (s) => s.employmentStatus === 'ACTIVE' && (HOUSEKEEPING_DEPARTMENTS as readonly string[]).includes(s.department),
  )
}

function toView(db: MockDatabase, task: HousekeepingTask): HousekeepingTaskView {
  const room = db.rooms.find((r) => r.id === task.roomId)
  return {
    ...toTaskSummary(db, task),
    roomId: task.roomId,
    floor: room?.floor ?? 0,
    roomStatus: room?.status ?? 'AVAILABLE',
    assignedStaffId: task.assignedStaffId,
    ...(task.notes ? { notes: task.notes } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt } : {}),
  }
}

// ------------------------------------------------------------------ queries

function list(query: HousekeepingListQuery = {}) {
  const db = getDatabase()
  const { date, status, floor, staffId, taskType, priority } = query
  return applyListQuery(
    db.housekeepingTasks.map((t) => toView(db, t)),
    query,
    {
      searchFields: (t) => [t.id, t.roomNumber, t.assignee, t.notes, enumLabel(t.taskType)],
      filter: (t) =>
        (!date || t.scheduledDate === date) &&
        (!status || t.status === status) &&
        (floor === undefined || t.floor === floor) &&
        (!staffId || t.assignedStaffId === staffId) &&
        (!taskType || t.taskType === taskType) &&
        (!priority || t.priority === priority),
      sortAccessors: {
        roomNumber: (t) => Number(t.roomNumber),
        priority: (t) => PRIORITY_ORDER[t.priority],
        status: (t) => STATUS_ORDER[t.status],
        taskType: (t) => HOUSEKEEPING_TASK_TYPES.indexOf(t.taskType),
      },
      // Work queue order: in progress, then pending, then done; urgent first; then by room.
      defaultSort: (a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        Number(a.roomNumber) - Number(b.roomNumber),
    },
  )
}

function summary(date: ISODate = todayISO()): HousekeepingSummary {
  const db = getDatabase()
  const onDate = db.housekeepingTasks.filter((t) => t.scheduledDate === date)
  const count = (s: HousekeepingStatus) => onDate.filter((t) => t.status === s).length
  return {
    date,
    pending: count('PENDING'),
    inProgress: count('IN_PROGRESS'),
    completed: count('COMPLETED'),
    roomsToClean: db.rooms.filter((r) => r.status === 'CLEANING').length,
    staff: assignableStaff(db)
      .map((s) => ({
        staffId: s.id,
        fullName: s.fullName,
        department: s.department,
        open: onDate.filter((t) => t.assignedStaffId === s.id && t.status !== 'COMPLETED').length,
        completed: onDate.filter((t) => t.assignedStaffId === s.id && t.status === 'COMPLETED').length,
      }))
      .sort((a, b) => a.open - b.open || a.fullName.localeCompare(b.fullName)),
  }
}

// ------------------------------------------------------------------ commands

function validate(db: MockDatabase, input: HousekeepingTaskInput, earliestDate: ISODate, exceptId?: string) {
  const task = parseOrThrow(housekeepingTaskSchema({ earliestDate }), input)
  const room = db.rooms.find((r) => r.id === task.roomId)
  if (!room) throw new ApiError(400, 'Validation failed', { roomId: 'Choose an existing room' })
  if (!assignableStaff(db).some((s) => s.id === task.assignedStaffId)) {
    throw new ApiError(400, 'Validation failed', { assignedStaffId: 'Assign an active housekeeping or maintenance staff member' })
  }
  const duplicate = db.housekeepingTasks.find(
    (t) =>
      t.id !== exceptId &&
      t.roomId === task.roomId &&
      t.taskType === task.taskType &&
      t.scheduledDate === task.scheduledDate &&
      t.status !== 'COMPLETED',
  )
  if (duplicate) {
    const message = `Room ${room.roomNumber} already has an open ${enumLabel(task.taskType).toLowerCase()} on ${formatDate(task.scheduledDate)} (${duplicate.id})`
    throw new ApiError(409, message, { taskType: message })
  }
  return task
}

function create(input: HousekeepingTaskInput): HousekeepingTaskView {
  const db = getDatabase()
  const task = validate(db, input, todayISO())
  return mutateDatabase((draft) => {
    const created: HousekeepingTask = { ...task, id: nextId(draft.housekeepingTasks.map((t) => t.id), 'HK'), status: 'PENDING' }
    draft.housekeepingTasks.push(created)
    return toView(draft, created)
  })
}

function update(id: string, input: HousekeepingTaskInput): HousekeepingTaskView {
  const db = getDatabase()
  const existing = findTask(db, id)
  if (existing.status === 'COMPLETED') throw new ApiError(409, `${id} is completed and can no longer be changed`)
  const today = todayISO()
  const task = validate(db, input, existing.scheduledDate < today ? existing.scheduledDate : today, id)
  return mutateDatabase((draft) => {
    const index = draft.housekeepingTasks.findIndex((t) => t.id === id)
    const updated: HousekeepingTask = { ...existing, ...task }
    if (!task.notes) delete updated.notes // cleared in the form
    draft.housekeepingTasks[index] = updated
    // Moving a clean to another room may leave the old room with nothing to wait for.
    if (existing.roomId !== updated.roomId) releaseRoomIfClean(draft, existing.roomId, today)
    return toView(draft, updated)
  })
}

function updateStatus(id: string, status: HousekeepingStatus): HousekeepingTaskView {
  if (!(HOUSEKEEPING_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError(400, 'Validation failed', { status: 'Unknown task status' })
  }
  const db = getDatabase()
  const task = findTask(db, id)
  if (!TASK_TRANSITIONS[task.status].includes(status)) {
    throw new ApiError(409, `${id} is ${enumLabel(task.status).toLowerCase()} and cannot become ${enumLabel(status).toLowerCase()}`)
  }
  return mutateDatabase((draft) => {
    const target = draft.housekeepingTasks.find((t) => t.id === id)!
    target.status = status
    if (status === 'COMPLETED') {
      target.completedAt = nowISODateTime()
      releaseRoomIfClean(draft, target.roomId, todayISO())
    }
    return toView(draft, target)
  })
}

function remove(id: string): void {
  const db = getDatabase()
  const task = findTask(db, id)
  if (task.status !== 'PENDING') {
    throw new ApiError(409, `${id} is ${enumLabel(task.status).toLowerCase()}; only pending tasks can be deleted`)
  }
  mutateDatabase((draft) => {
    draft.housekeepingTasks = draft.housekeepingTasks.filter((t) => t.id !== id)
  })
}

export const mockHousekeepingService: HousekeepingService = {
  list: (query) => mockCall(() => list(query)),
  summary: (date) => mockCall(() => summary(date)),
  create: (input) => mockCall(() => create(input)),
  update: (id, input) => mockCall(() => update(id, input)),
  updateStatus: (id, status) => mockCall(() => updateStatus(id, status)),
  remove: (id) => mockCall(() => remove(id)),
}
