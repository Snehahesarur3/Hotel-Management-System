import type { StaffService } from '@/api/types'
import { applyListQuery, nextId } from '@/mock/collection'
import { getDatabase, mutateDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { staffInputSchema } from '@/schemas/staff'
import { ApiError } from '@/types/api'
import type { StaffMember } from '@/types/domain'
import { DEPARTMENTS, EMPLOYMENT_STATUSES } from '@/types/enums'
import { HOUSEKEEPING_DEPARTMENTS } from '@/types/housekeeping'
import type { StaffInput, StaffListQuery, StaffSummary, StaffView } from '@/types/staff'
import { todayISO } from '@/utils/date'
import { enumLabel } from '@/utils/format'

/**
 * Mock implementation of /api/staff.
 * - Work emails are unique (ignoring case).
 * - Someone with open housekeeping tasks stays active and in an assignable department until the tasks are reassigned.
 * - Staff with any task history cannot be deleted (records stay intact); set them Inactive instead.
 */

const openTasksOf = (db: MockDatabase, staffId: string) =>
  db.housekeepingTasks.filter((t) => t.assignedStaffId === staffId && t.status !== 'COMPLETED').length

const toView = (db: MockDatabase, s: StaffMember): StaffView => ({ ...s, openTasks: openTasksOf(db, s.id) })

function findStaff(db: MockDatabase, id: string): StaffMember {
  const member = db.staff.find((s) => s.id === id)
  if (!member) throw new ApiError(404, `Staff member with id '${id}' was not found`)
  return member
}

function assertEmailAvailable(db: MockDatabase, email: string, exceptId?: string) {
  const clash = db.staff.find((s) => s.email.toLowerCase() === email.toLowerCase() && s.id !== exceptId)
  if (clash) {
    const message = `This email belongs to ${clash.fullName}`
    throw new ApiError(409, message, { email: message })
  }
}

function list(query: StaffListQuery = {}) {
  const db = getDatabase()
  const { department, status } = query
  return applyListQuery(
    db.staff.map((s) => toView(db, s)),
    query,
    {
      searchFields: (s) => [s.fullName, s.email, s.phone, s.id, s.designation, enumLabel(s.department)],
      filter: (s) => (!department || s.department === department) && (!status || s.employmentStatus === status),
      sortAccessors: {
        department: (s) => DEPARTMENTS.indexOf(s.department),
        employmentStatus: (s) => EMPLOYMENT_STATUSES.indexOf(s.employmentStatus),
      },
      defaultSort: (a, b) => a.fullName.localeCompare(b.fullName),
    },
  )
}

function summary(): StaffSummary {
  const { staff } = getDatabase()
  const count = (s: StaffMember['employmentStatus']) => staff.filter((m) => m.employmentStatus === s).length
  return {
    total: staff.length,
    active: count('ACTIVE'),
    onLeave: count('ON_LEAVE'),
    inactive: count('INACTIVE'),
    byDepartment: DEPARTMENTS.map((department) => {
      const inDept = staff.filter((m) => m.department === department)
      return { department, total: inDept.length, active: inDept.filter((m) => m.employmentStatus === 'ACTIVE').length }
    }),
  }
}

function create(raw: StaffInput): StaffView {
  const db = getDatabase()
  const input = parseOrThrow(staffInputSchema({ today: todayISO() }), raw)
  assertEmailAvailable(db, input.email)
  return mutateDatabase((draft) => {
    const member: StaffMember = { ...input, id: nextId(draft.staff.map((s) => s.id), 'STF') }
    draft.staff.push(member)
    return toView(draft, member)
  })
}

function update(id: string, raw: StaffInput): StaffView {
  const db = getDatabase()
  const existing = findStaff(db, id)
  const input = parseOrThrow(staffInputSchema({ today: todayISO() }), raw)
  assertEmailAvailable(db, input.email, id)

  const open = openTasksOf(db, id)
  if (open > 0) {
    const tasks = `${open} open housekeeping task${open === 1 ? '' : 's'}`
    if (input.employmentStatus !== 'ACTIVE') {
      const message = `${existing.fullName} has ${tasks}. Reassign them before changing the status.`
      throw new ApiError(409, message, { employmentStatus: message })
    }
    if (!(HOUSEKEEPING_DEPARTMENTS as readonly string[]).includes(input.department)) {
      const message = `${existing.fullName} has ${tasks}. Reassign them before moving to ${enumLabel(input.department)}.`
      throw new ApiError(409, message, { department: message })
    }
  }

  return mutateDatabase((draft) => {
    const index = draft.staff.findIndex((s) => s.id === id)
    const member: StaffMember = { ...input, id }
    draft.staff[index] = member
    return toView(draft, member)
  })
}

function remove(id: string): void {
  const db = getDatabase()
  const member = findStaff(db, id)
  const tasks = db.housekeepingTasks.filter((t) => t.assignedStaffId === id).length
  if (tasks > 0) {
    throw new ApiError(
      409,
      `${member.fullName} has ${tasks} housekeeping task${tasks === 1 ? '' : 's'} on record and cannot be deleted. Set them to Inactive instead.`,
    )
  }
  mutateDatabase((draft) => {
    draft.staff = draft.staff.filter((s) => s.id !== id)
  })
}

export const mockStaffService: StaffService = {
  list: (query) => mockCall(() => list(query)),
  summary: () => mockCall(summary),
  get: (id) => mockCall(() => toView(getDatabase(), findStaff(getDatabase(), id))),
  create: (input) => mockCall(() => create(input)),
  update: (id, input) => mockCall(() => update(id, input)),
  remove: (id) => mockCall(() => remove(id)),
}
