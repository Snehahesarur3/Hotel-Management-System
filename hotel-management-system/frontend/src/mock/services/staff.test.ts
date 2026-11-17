import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import type { StaffInput } from '@/types/staff'
import { addDays, todayISO } from '@/utils/date'
import { mockStaffService as staff } from './staff'

const TODAY = todayISO()
const newHire: StaffInput = {
  fullName: 'Neha Kamath',
  email: 'neha.kamath@aureliabay.example',
  phone: '+91 90000 51111',
  department: 'RECEPTION',
  designation: 'Front Office Associate',
  joiningDate: TODAY,
  employmentStatus: 'ACTIVE',
}
const asInput = (id: string): StaffInput => {
  const { id: _id, ...rest } = getDatabase().staff.find((s) => s.id === id)!
  void _id
  return rest
}

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('staff directory', () => {
  it('lists, filters and counts staff', async () => {
    const page = await staff.list({ size: 50 })
    expect(page.totalElements).toBe(15)
    expect(page.content[0]!.fullName).toBe('Alisha Coutinho')
    expect((await staff.list({ department: 'HOUSEKEEPING' })).totalElements).toBe(4)
    expect((await staff.list({ status: 'ON_LEAVE' })).content.map((s) => s.fullName)).toEqual(['Fatima Sheikh'])
    expect((await staff.get('STF-0007')).openTasks).toBe(3)

    const summary = await staff.summary()
    expect(summary).toMatchObject({ total: 15, active: 13, onLeave: 1, inactive: 1 })
    expect(summary.byDepartment.find((d) => d.department === 'RESTAURANT')).toEqual({ department: 'RESTAURANT', total: 3, active: 2 })
  })
})

describe('adding and editing staff', () => {
  it('validates and keeps work emails unique', async () => {
    expect(await staff.create(newHire)).toMatchObject({ id: 'STF-0016', openTasks: 0 })
    await expect(staff.create({ ...newHire, email: 'Priya.Menon@aureliabay.example' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { email: 'This email belongs to Priya Menon' },
    })
    await expect(staff.create({ ...newHire, email: 'x@y.example', joiningDate: addDays(TODAY, 120) })).rejects.toMatchObject({
      fieldErrors: { joiningDate: expect.stringMatching(/^Joining date can be at most 90 days ahead/) },
    })
  })

  it('keeps people with open housekeeping tasks active and assignable', async () => {
    await expect(staff.update('STF-0007', { ...asInput('STF-0007'), employmentStatus: 'ON_LEAVE' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { employmentStatus: 'Sunil Parab has 3 open housekeeping tasks. Reassign them before changing the status.' },
    })
    await expect(staff.update('STF-0007', { ...asInput('STF-0007'), department: 'RECEPTION' })).rejects.toMatchObject({
      fieldErrors: { department: 'Sunil Parab has 3 open housekeeping tasks. Reassign them before moving to Reception.' },
    })
    expect((await staff.update('STF-0007', { ...asInput('STF-0007'), department: 'MAINTENANCE' })).department).toBe('MAINTENANCE')
    expect((await staff.update('STF-0011', { ...asInput('STF-0011'), employmentStatus: 'INACTIVE' })).employmentStatus).toBe('INACTIVE')
  })

  it('deletes only staff without task history', async () => {
    await expect(staff.remove('STF-0007')).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/^Sunil Parab has \d+ housekeeping tasks on record and cannot be deleted/),
    })
    await staff.remove('STF-0015')
    expect(getDatabase().staff).toHaveLength(14)
    await expect(staff.get('STF-0015')).rejects.toMatchObject({ status: 404 })
  })
})
