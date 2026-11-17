import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, mutateDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import type { RoomInput } from '@/types/room'
import { mockRoomService as rooms } from './rooms'

const newRoom: RoomInput = {
  roomNumber: '511',
  floor: 5,
  type: 'SUITE',
  capacity: 4,
  pricePerNight: 12500,
  amenities: ['Wi-Fi', 'Balcony'],
  status: 'AVAILABLE',
  description: 'Corner suite',
}

const inputOf = (id: string): RoomInput => {
  const { id: _id, ...rest } = getDatabase().rooms.find((r) => r.id === id)!
  void _id
  return rest
}

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('room listing', () => {
  it('paginates, ordered by room number by default', async () => {
    const page = await rooms.list({ size: 15 })
    expect(page.totalElements).toBe(50)
    expect(page.totalPages).toBe(4)
    expect(page.content[0]!.roomNumber).toBe('101')
    expect(page.content[14]!.roomNumber).toBe('205')
  })

  it('filters by floor, type and status', async () => {
    expect((await rooms.list({ floor: 3 })).totalElements).toBe(10)
    expect((await rooms.list({ type: 'PRESIDENTIAL' })).content.map((r) => r.roomNumber)).toEqual(['509', '510'])
    expect((await rooms.list({ status: 'OCCUPIED' })).totalElements).toBe(14)
    expect((await rooms.list({ floor: 5, type: 'SUITE', status: 'OCCUPIED' })).content.map((r) => r.roomNumber)).toEqual(['503', '506'])
  })

  it('searches numbers, labels and amenities', async () => {
    expect((await rooms.list({ search: 'jacuzzi' })).totalElements).toBe(2)
    expect((await rooms.list({ search: '305' })).content[0]!.status).toBe('MAINTENANCE')
    expect((await rooms.list({ search: 'under maintenance' })).totalElements).toBe(0)
  })

  it('sorts by price descending and by room number numerically', async () => {
    const byPrice = await rooms.list({ sort: { field: 'pricePerNight', direction: 'desc' }, size: 3 })
    expect(byPrice.content.map((r) => r.roomNumber)).toEqual(['509', '510', '503'])
    const byNumberDesc = await rooms.list({ sort: { field: 'roomNumber', direction: 'desc' }, size: 1 })
    expect(byNumberDesc.content[0]!.roomNumber).toBe('510')
  })

  it('lists distinct floors', async () => {
    expect(await rooms.floors()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('creating and updating rooms', () => {
  it('creates a room with an id derived from its number', async () => {
    const created = await rooms.create(newRoom)
    expect(created).toMatchObject({ id: 'RM-511', roomNumber: '511', status: 'AVAILABLE' })
    expect(reloadDatabaseFromStorage().rooms).toHaveLength(51)
  })

  it('rejects a duplicate room number with a field error', async () => {
    await expect(rooms.create({ ...newRoom, roomNumber: '503' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { roomNumber: 'Room 503 already exists' },
    })
  })

  it('validates input server-side like the backend (400 + field errors)', async () => {
    await expect(rooms.create({ ...newRoom, roomNumber: '611', capacity: 0 })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { roomNumber: 'Room numbers on floor 5 look like 501–599', capacity: 'At least 1 guest' },
    })
  })

  it('does not let a new room start as Occupied or Reserved', async () => {
    await expect(rooms.create({ ...newRoom, status: 'OCCUPIED' })).rejects.toMatchObject({ status: 400 })
  })

  it('updates details while keeping the id', async () => {
    const updated = await rooms.update('RM-101', { ...inputOf('RM-101'), pricePerNight: 3800, amenities: ['Wi-Fi'] })
    expect(updated).toMatchObject({ id: 'RM-101', pricePerNight: 3800, amenities: ['Wi-Fi'] })
  })

  it('refuses a capacity below an active booking’s party size', async () => {
    // Room 102 has a checked-in stay for 2 guests.
    await expect(rooms.update('RM-102', { ...inputOf('RM-102'), capacity: 1 })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { capacity: expect.stringContaining('2 guests') },
    })
  })

  it('returns 404 for unknown rooms', async () => {
    await expect(rooms.get('RM-999')).rejects.toMatchObject({ status: 404 })
    await expect(rooms.update('RM-999', newRoom)).rejects.toMatchObject({ status: 404 })
  })
})

describe('room status rules', () => {
  it('allows manual changes between Available, Cleaning and Maintenance', async () => {
    expect((await rooms.updateStatus('RM-101', 'MAINTENANCE')).status).toBe('MAINTENANCE')
    expect((await rooms.updateStatus('RM-101', 'CLEANING')).status).toBe('CLEANING')
    expect((await rooms.updateStatus('RM-101', 'AVAILABLE')).status).toBe('AVAILABLE')
  })

  it('protects rooms with a guest in-house or an arrival today', async () => {
    await expect(rooms.updateStatus('RM-102', 'AVAILABLE')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('in-house') })
    await expect(rooms.updateStatus('RM-104', 'MAINTENANCE')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('BK-0027') })
  })

  it('never sets Occupied or Reserved by hand', async () => {
    await expect(rooms.updateStatus('RM-101', 'OCCUPIED')).rejects.toMatchObject({ status: 400 })
    await expect(rooms.updateStatus('RM-101', 'RESERVED')).rejects.toMatchObject({ status: 400 })
  })

  it('marks a room Reserved instead of Available when a guest arrives today', async () => {
    mutateDatabase((db) => {
      db.rooms.find((r) => r.id === 'RM-104')!.status = 'CLEANING'
    })
    expect((await rooms.updateStatus('RM-104', 'AVAILABLE')).status).toBe('RESERVED')
  })

  it('applies the same rules when the status is changed through an edit', async () => {
    await expect(rooms.update('RM-102', { ...inputOf('RM-102'), status: 'AVAILABLE' })).rejects.toMatchObject({ status: 409 })
  })
})

describe('deleting rooms', () => {
  it('refuses rooms with history and explains why', async () => {
    await expect(rooms.remove('RM-107')).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/1 reservation, 1 housekeeping task, 1 restaurant order.*Maintenance/),
    })
    expect(getDatabase().rooms).toHaveLength(50)
  })

  it('deletes a room without history', async () => {
    await rooms.create(newRoom)
    await rooms.remove('RM-511')
    expect(getDatabase().rooms.some((r) => r.id === 'RM-511')).toBe(false)
  })
})

describe('room activity', () => {
  it('summarises the current stay, upcoming stays, history and housekeeping', async () => {
    const activity = await rooms.activity('RM-102')
    expect(activity.currentStay).toMatchObject({ id: 'BK-0013', guestName: 'Arjun Reddy' })
    expect(activity.upcoming.map((r) => r.id)).toEqual(['BK-0032'])
    expect(activity.history).toEqual([])
    expect(activity.housekeeping.map((t) => t.taskType)).toEqual(['DAILY_SERVICE'])
  })
})
