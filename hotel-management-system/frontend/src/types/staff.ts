import type { ListQuery } from './api'
import type { StaffMember } from './domain'
import type { Department, EmploymentStatus } from './enums'

/** Body of POST /api/staff and PUT /api/staff/{id}. */
export type StaffInput = Omit<StaffMember, 'id'>

/** Staff member as returned by the API, with derived workload. */
export interface StaffView extends StaffMember {
  /** Pending or in-progress housekeeping tasks assigned to this person. */
  openTasks: number
}

export type StaffSortField = 'fullName' | 'department' | 'designation' | 'joiningDate' | 'employmentStatus'

/** GET /api/staff?search=&department=&status=&page=&size=&sort= */
export type StaffListQuery = ListQuery<StaffSortField> & { department?: Department; status?: EmploymentStatus }

/** GET /api/staff/summary */
export interface StaffSummary {
  total: number
  active: number
  onLeave: number
  inactive: number
  byDepartment: Array<{ department: Department; total: number; active: number }>
}
