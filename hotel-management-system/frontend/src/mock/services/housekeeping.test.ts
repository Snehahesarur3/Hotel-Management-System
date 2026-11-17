import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import type { HousekeepingTaskInput } from '@/types/housekeeping'
import { addDays, todayISO } from '@/utils/date'
import { mockHousekeepingService as housekeeping } from './housekeeping'
import { mockReservationService as reservations } from './reservations'

const TODAY = todayISO()
const room = (id: string) => getDatabase().rooms.find((r) => r.id === id)!
const task = (id: string) => getDatabase().housekeepingTasks.find((t) => t.id === id)!
const input = (overrides: Partial<HousekeepingTaskInput> = {}): HousekeepingTaskInput => ({
  roomId: 'RM-201',
  assignedStaffId: 'STF-0006',
  taskType: 'INSPECTION',
  priority: 'NORMAL',
  scheduledDate: TODAY,
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('task list and summary', () => {
  it('lists a day as a work queue: in progress, then pending, then done, urgent first', async () => {
    const page = await housekeeping.list({ date: TODAY, size: 50 })
    expect(page.totalElements).toBe(13)
    expect(page.content.slice(0, 3).map((t) => t.id)).toEqual(['HK-0001', 'HK-0012', 'HK-0009'])
    expect(page.content.at(-1)!.status).toBe('COMPLETED')
    expect(page.content[0]).toMatchObject({ roomNumber: '107', floor: 1, roomStatus: 'CLEANING', assignee: 'Sunil Parab' })
  })

  it('filters by floor, staff, status and type', async () => {
    expect((await housekeeping.list({ date: TODAY, floor: 5 })).content.map((t) => t.id).sort()).toEqual(['HK-0011', 'HK-0012'])
    expect((await housekeeping.list({ staffId: 'STF-0008', status: 'PENDING' })).content.map((t) => t.id).sort()).toEqual(['HK-0002', 'HK-0011'])
    expect((await housekeeping.list({ taskType: 'DEEP_CLEAN' })).totalElements).toBe(2)
    expect((await housekeeping.list({ search: 'maria' })).content.every((t) => t.assignee === "Maria D'Souza")).toBe(true)
  })

  it('summarises the day and staff workload, least busy first', async () => {
    const summary = await housekeeping.summary()
    expect(summary).toMatchObject({ date: TODAY, pending: 3, inProgress: 3, completed: 7, roomsToClean: 2 })
    expect(summary.staff).toHaveLength(6) // 4 housekeeping + 2 maintenance
    const opens = summary.staff.map((s) => s.open)
    expect([...opens].sort((a, b) => a - b)).toEqual(opens)
  })
})

describe('task status and room readiness', () => {
  it('frees a room when its last clean is completed', async () => {
    expect(room('RM-107').status).toBe('CLEANING')
    const done = await housekeeping.updateStatus('HK-0001', 'COMPLETED')
    expect(done).toMatchObject({ status: 'COMPLETED', roomStatus: 'AVAILABLE', completedAt: expect.stringMatching(new RegExp(`^${TODAY}T`)) })
    expect(room('RM-107').status).toBe('AVAILABLE')
  })

  it('holds the room for a guest arriving today', async () => {
    await reservations.create({ guestId: 'GST-0002', roomId: 'RM-303', checkIn: TODAY, checkOut: addDays(TODAY, 1), numberOfGuests: 1, source: 'PHONE', status: 'CONFIRMED' })
    expect(room('RM-303').status).toBe('CLEANING') // a dirty room is not shown as reserved
    await housekeeping.updateStatus('HK-0002', 'IN_PROGRESS')
    await housekeeping.updateStatus('HK-0002', 'COMPLETED')
    expect(room('RM-303').status).toBe('RESERVED')
  })

  it('keeps the room in Cleaning while another clean is open, and never frees maintenance rooms', async () => {
    await housekeeping.create(input({ roomId: 'RM-107', taskType: 'DEEP_CLEAN' }))
    await housekeeping.updateStatus('HK-0001', 'COMPLETED')
    expect(room('RM-107').status).toBe('CLEANING')

    await housekeeping.updateStatus('HK-0014', 'COMPLETED') // deep clean of RM-110, under maintenance
    expect(room('RM-110').status).toBe('MAINTENANCE')
  })

  it('allows pausing but not reopening completed work', async () => {
    expect((await housekeeping.updateStatus('HK-0009', 'PENDING')).status).toBe('PENDING')
    await expect(housekeeping.updateStatus('HK-0003', 'IN_PROGRESS')).rejects.toMatchObject({
      status: 409,
      message: 'HK-0003 is completed and cannot become in progress',
    })
    await expect(housekeeping.updateStatus('HK-9999', 'COMPLETED')).rejects.toMatchObject({ status: 404 })
  })
})

describe('creating, editing and deleting tasks', () => {
  it('creates pending tasks for active housekeeping or maintenance staff', async () => {
    const created = await housekeeping.create(input({ assignedStaffId: 'STF-0013', notes: '  AC check  ' }))
    expect(created).toMatchObject({ id: 'HK-0021', status: 'PENDING', assignee: 'Ramesh Yadav', notes: 'AC check' })
    await expect(housekeeping.create(input({ assignedStaffId: 'STF-0003' }))).rejects.toMatchObject({
      fieldErrors: { assignedStaffId: 'Assign an active housekeeping or maintenance staff member' },
    })
    await expect(housekeeping.create(input({ scheduledDate: addDays(TODAY, -1) }))).rejects.toMatchObject({
      fieldErrors: { scheduledDate: expect.stringMatching(/^Schedule on or after/) },
    })
  })

  it('rejects a second open task of the same type for a room on the same day', async () => {
    await expect(housekeeping.create(input({ roomId: 'RM-404', taskType: 'DAILY_SERVICE' }))).rejects.toMatchObject({
      status: 409,
      fieldErrors: { taskType: expect.stringMatching(/Room 404 already has an open daily service .* \(HK-0010\)$/) },
    })
  })

  it('reassigns open tasks, locks completed ones, and deletes only pending ones', async () => {
    const t = task('HK-0010')
    const updated = await housekeeping.update('HK-0010', { ...input(), roomId: t.roomId, taskType: t.taskType, assignedStaffId: 'STF-0009', priority: 'HIGH' })
    expect(updated).toMatchObject({ assignee: 'Ganesh Shetty', priority: 'HIGH' })
    await expect(housekeeping.update('HK-0003', input())).rejects.toMatchObject({ status: 409 })

    await expect(housekeeping.remove('HK-0001')).rejects.toMatchObject({ status: 409, message: 'HK-0001 is in progress; only pending tasks can be deleted' })
    await housekeeping.remove('HK-0010')
    expect(getDatabase().housekeepingTasks.some((x) => x.id === 'HK-0010')).toBe(false)
  })
})
