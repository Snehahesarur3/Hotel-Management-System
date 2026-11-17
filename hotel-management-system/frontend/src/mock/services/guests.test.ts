import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import type { GuestInput } from '@/types/guest'
import { todayISO } from '@/utils/date'
import { mockGuestService as guests } from './guests'

const newGuest: GuestInput = {
  fullName: 'Rhea Costa',
  email: 'rhea.costa@example.com',
  phone: '+91 90000 11111',
  address: '12 Altinho, Panaji, Goa',
  nationality: 'Indian',
  idProofType: 'PASSPORT',
  idProofNumber: 'Z9876543',
}

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('guest listing', () => {
  it('lists guests alphabetically with derived booking counts', async () => {
    const page = await guests.list({ size: 50 })
    expect(page.totalElements).toBe(30)
    expect(page.content[0]!.fullName).toBe('Aarav Mehta')
    expect(page.content[0]).toMatchObject({ previousBookingCount: 1 })
    expect(page.content[0]!.lastStay).not.toBeNull()
  })

  it('searches by name, email, phone or id and filters by nationality', async () => {
    expect((await guests.list({ search: 'kenji' })).content.map((g) => g.id)).toEqual(['GST-0028'])
    expect((await guests.list({ search: 'GST-0005' })).content[0]!.fullName).toBe('Rohan Kulkarni')
    expect((await guests.list({ nationality: 'british' })).totalElements).toBe(2)
  })

  it('sorts by derived values', async () => {
    const page = await guests.list({ sort: { field: 'previousBookingCount', direction: 'desc' }, size: 3 })
    expect(page.content.every((g) => g.previousBookingCount >= 1)).toBe(true)
  })

  it('lists distinct nationalities', async () => {
    expect(await guests.nationalities()).toEqual([
      'American', 'Australian', 'British', 'Emirati', 'French', 'German', 'Indian', 'Italian', 'Japanese',
    ])
  })
})

describe('guest profile', () => {
  it('summarises stays, nights and spend from reservations and payments', async () => {
    const history = await guests.history('GST-0001')
    expect(history.stats).toEqual({
      totalReservations: 2,
      completedStays: 1,
      upcomingStays: 0,
      cancelled: 0,
      nightsStayed: 2,
      totalSpent: 15501.5,
    })
    // Both stays start on the same day; the more recently booked one comes first.
    expect(history.reservations.map((r) => r.id)).toEqual(['BK-0021', 'BK-0001'])
  })

  it('returns 404 for unknown guests', async () => {
    await expect(guests.get('GST-9999')).rejects.toMatchObject({ status: 404 })
    await expect(guests.history('GST-9999')).rejects.toMatchObject({ status: 404 })
  })
})

describe('creating and updating guests', () => {
  it('registers a guest today with a masked ID number', async () => {
    const created = await guests.create(newGuest)
    expect(created).toMatchObject({
      id: 'GST-0031',
      idProofNumber: 'XXXXX6543',
      registrationDate: todayISO(),
      previousBookingCount: 0,
      lastStay: null,
    })
    expect(JSON.stringify(getDatabase())).not.toContain('Z9876543')
  })

  it('rejects a duplicate email regardless of case', async () => {
    await expect(guests.create({ ...newGuest, email: 'Aarav.Mehta@example.com' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { email: 'This email is already registered to Aarav Mehta' },
    })
  })

  it('validates input server-side', async () => {
    await expect(guests.create({ ...newGuest, idProofNumber: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { idProofNumber: 'Enter the ID number' },
    })
  })

  it('keeps the stored ID number when none is entered on update', async () => {
    const { id: _id, registrationDate: _r, idProofNumber: _n, ...rest } = getDatabase().guests.find((g) => g.id === 'GST-0002')!
    void [_id, _r, _n]
    const updated = await guests.update('GST-0002', { ...rest, phone: '+91 90000 22222', idProofNumber: '' })
    expect(updated).toMatchObject({ phone: '+91 90000 22222', idProofNumber: 'XXXX-XXXX-1542' })
  })

  it('requires a new number when the ID document type changes', async () => {
    const { id: _id, registrationDate: _r, ...rest } = getDatabase().guests.find((g) => g.id === 'GST-0002')!
    void [_id, _r]
    await expect(guests.update('GST-0002', { ...rest, idProofType: 'PASSPORT', idProofNumber: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { idProofNumber: 'Enter the number of the new ID document' },
    })
  })
})

describe('deleting guests', () => {
  it('keeps guests with reservations', async () => {
    await expect(guests.remove('GST-0001')).rejects.toMatchObject({
      status: 409,
      message: 'Aarav Mehta has 2 reservations and cannot be deleted. Guest records with booking history are kept.',
    })
  })

  it('deletes guests without reservations', async () => {
    const created = await guests.create(newGuest)
    await guests.remove(created.id)
    expect(getDatabase().guests).toHaveLength(30)
  })
})
