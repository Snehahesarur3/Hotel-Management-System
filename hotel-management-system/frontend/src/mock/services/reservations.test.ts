import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, mutateDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import type { ReservationInput } from '@/types/reservation'
import { addDays, todayISO } from '@/utils/date'
import { mockReservationService as reservations } from './reservations'

const TODAY = todayISO()
const day = (offset: number) => addDays(TODAY, offset)
const room = (id: string) => getDatabase().rooms.find((r) => r.id === id)!
const booking = (id: string) => getDatabase().reservations.find((r) => r.id === id)!

const input = (overrides: Partial<ReservationInput> = {}): ReservationInput => ({
  guestId: 'GST-0010',
  roomId: 'RM-101',
  checkIn: day(0),
  checkOut: day(2),
  numberOfGuests: 2,
  source: 'PHONE',
  status: 'CONFIRMED',
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('listing reservations', () => {
  it('lists every booking, latest check-in first', async () => {
    const page = await reservations.list({ size: 50 })
    expect(page.totalElements).toBe(40)
    const checkIns = page.content.map((r) => r.checkIn)
    expect([...checkIns].sort().reverse()).toEqual(checkIns)
    expect(page.content[0]).toMatchObject({ guestName: expect.any(String), roomId: expect.stringMatching(/^RM-/) })
  })

  it('searches by booking id, guest name or email and room number', async () => {
    expect((await reservations.list({ search: 'BK-0027' })).content.map((r) => r.id)).toEqual(['BK-0027'])
    const byEmail = await reservations.list({ search: 'aarav.mehta@example.com' })
    expect(byEmail.content.every((r) => r.guestName === 'Aarav Mehta')).toBe(true)
    expect(byEmail.totalElements).toBe(2)
    expect((await reservations.list({ search: '104' })).content.map((r) => r.id)).toContain('BK-0027')
  })

  it('filters by status, source and stay dates', async () => {
    expect((await reservations.list({ status: 'CONFIRMED' })).totalElements).toBe(8)
    expect((await reservations.list({ status: 'CANCELLED' })).totalElements).toBe(4)
    const web = await reservations.list({ source: 'WEBSITE', size: 50 })
    expect(web.content.every((r) => r.source === 'WEBSITE')).toBe(true)

    const onToday = await reservations.list({ from: TODAY, to: TODAY, size: 50 })
    expect(onToday.totalElements).toBeGreaterThan(0)
    expect(onToday.content.every((r) => r.checkIn <= TODAY && r.checkOut >= TODAY)).toBe(true)
    const future = await reservations.list({ from: day(10), size: 50 })
    expect(future.content.every((r) => r.checkOut >= day(10))).toBe(true)
  })

  it('sorts by derived values', async () => {
    const page = await reservations.list({ sort: { field: 'totalAmount', direction: 'desc' }, size: 5 })
    const totals = page.content.map((r) => r.totalAmount)
    expect([...totals].sort((a, b) => b - a)).toEqual(totals)
  })
})

describe('availability', () => {
  it('offers free rooms that fit the party, with GST-inclusive quotes', async () => {
    const rooms = await reservations.availability({ checkIn: day(0), checkOut: day(2), guests: 2 })
    const ids = rooms.map((r) => r.room.id)
    expect(ids).toContain('RM-101')
    expect(ids).not.toContain('RM-104') // BK-0027 arrives today
    expect(ids).not.toContain('RM-102') // in-house until tomorrow
    expect(ids).not.toContain('RM-110') // maintenance
    expect(rooms.find((r) => r.room.id === 'RM-101')!.quote).toEqual({
      nights: 2,
      roomRate: 3500,
      roomCharges: 7000,
      gstPercent: 12,
      gstAmount: 840,
      total: 7840,
    })
  })

  it('applies the higher GST slab above ₹7,500 per night and filters by capacity and type', async () => {
    const rooms = await reservations.availability({ checkIn: day(1), checkOut: day(2), guests: 5 })
    expect(rooms.every((r) => r.room.capacity >= 5)).toBe(true)
    expect(rooms.find((r) => r.room.id === 'RM-510')!.quote).toMatchObject({ gstPercent: 18, gstAmount: 4500, total: 29500 })
    const suites = await reservations.availability({ checkIn: day(1), checkOut: day(2), guests: 1, type: 'SUITE' })
    expect(suites.length).toBeGreaterThan(0)
    expect(suites.every((r) => r.room.type === 'SUITE')).toBe(true)
  })

  it('treats a departure and an arrival on the same day as no clash', async () => {
    // RM-106 is booked from day 3 to day 5 (BK-0030).
    const before = await reservations.availability({ checkIn: day(1), checkOut: day(3), guests: 2 })
    expect(before.map((r) => r.room.id)).toContain('RM-106')
    const overlapping = await reservations.availability({ checkIn: day(1), checkOut: day(4), guests: 2 })
    expect(overlapping.map((r) => r.room.id)).not.toContain('RM-106')
  })

  it('shows the edited booking’s own room at its locked-in rate', async () => {
    mutateDatabase((db) => {
      db.rooms.find((r) => r.id === 'RM-104')!.pricePerNight = 4000
    })
    const rooms = await reservations.availability({ checkIn: day(0), checkOut: day(2), guests: 2, excludeReservationId: 'BK-0027' })
    expect(rooms.find((r) => r.room.id === 'RM-104')!.quote.roomRate).toBe(3500)
  })

  it('rejects invalid stays', async () => {
    await expect(reservations.availability({ checkIn: day(-1), checkOut: day(1), guests: 2 })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { checkIn: 'Check-in cannot be in the past' },
    })
    await expect(reservations.availability({ checkIn: day(2), checkOut: day(2), guests: 2 })).rejects.toMatchObject({
      fieldErrors: { checkOut: 'Check-out must be after check-in' },
    })
    await expect(reservations.availability({ checkIn: day(1), checkOut: day(40), guests: 0 })).rejects.toMatchObject({
      fieldErrors: { checkOut: 'A booking can cover at most 30 nights', guests: 'Enter 1–10 guests' },
    })
  })
})

describe('creating reservations', () => {
  it('locks in the room rate and holds the room for a same-day arrival', async () => {
    expect(room('RM-101').status).toBe('AVAILABLE')
    const created = await reservations.create(input())
    expect(created).toMatchObject({ id: 'BK-0041', status: 'CONFIRMED', nights: 2, totalAmount: 7000, roomNumber: '101' })
    expect(booking('BK-0041')).toMatchObject({ roomRate: 3500, createdAt: expect.stringMatching(new RegExp(`^${TODAY}T`)) })
    expect(room('RM-101').status).toBe('RESERVED')
  })

  it('leaves the room available for a future arrival', async () => {
    await reservations.create(input({ checkIn: day(3), checkOut: day(4), status: 'PENDING' }))
    expect(room('RM-101').status).toBe('AVAILABLE')
  })

  it('prevents double bookings', async () => {
    await expect(reservations.create(input({ roomId: 'RM-104', checkIn: day(1), checkOut: day(3) }))).rejects.toMatchObject({
      status: 409,
      fieldErrors: { roomId: expect.stringMatching(/^Room 104 is already booked .* \(BK-0027\)$/) },
    })
    expect(getDatabase().reservations).toHaveLength(40)
  })

  it('enforces capacity, maintenance, dates and references', async () => {
    await expect(reservations.create(input({ numberOfGuests: 3 }))).rejects.toMatchObject({
      status: 400,
      fieldErrors: { numberOfGuests: 'Room 101 sleeps at most 2 guests' },
    })
    await expect(reservations.create(input({ roomId: 'RM-110' }))).rejects.toMatchObject({
      status: 409,
      fieldErrors: { roomId: 'Room 110 is under maintenance and cannot be booked' },
    })
    await expect(reservations.create(input({ checkIn: day(-1) }))).rejects.toMatchObject({
      status: 400,
      fieldErrors: { checkIn: expect.stringMatching(/^Check-in cannot be before/) },
    })
    await expect(reservations.create(input({ guestId: 'GST-9999' }))).rejects.toMatchObject({
      fieldErrors: { guestId: 'Select an existing guest' },
    })
  })
})

describe('editing reservations', () => {
  it('moves a booking to another room, re-locking the rate and updating both rooms', async () => {
    const updated = await reservations.update('BK-0027', input({ guestId: 'GST-0017', roomId: 'RM-208' }))
    expect(updated).toMatchObject({ roomNumber: '208', totalAmount: 11000 })
    expect(booking('BK-0027').roomRate).toBe(5500)
    expect(room('RM-104').status).toBe('AVAILABLE')
    expect(room('RM-208').status).toBe('RESERVED')
  })

  it('keeps the locked-in rate when only the dates change', async () => {
    mutateDatabase((db) => {
      db.rooms.find((r) => r.id === 'RM-104')!.pricePerNight = 4000
    })
    await reservations.update('BK-0027', input({ guestId: 'GST-0017', roomId: 'RM-104', checkIn: day(1), checkOut: day(3) }))
    expect(booking('BK-0027')).toMatchObject({ roomRate: 3500, checkIn: day(1) })
    expect(room('RM-104').status).toBe('AVAILABLE') // the arrival moved to tomorrow
  })

  it('refuses to edit in-house or finished stays', async () => {
    await expect(reservations.update('BK-0013', input({ roomId: 'RM-102' }))).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/^BK-0013 is checked in and cannot be edited/),
    })
  })
})

describe('cancelling reservations', () => {
  it('cancels a booking and releases the room', async () => {
    const cancelled = await reservations.cancel('BK-0027')
    expect(cancelled.status).toBe('CANCELLED')
    expect(room('RM-104').status).toBe('AVAILABLE')
    const free = await reservations.availability({ checkIn: day(0), checkOut: day(2), guests: 2 })
    expect(free.map((r) => r.room.id)).toContain('RM-104')
  })

  it('only cancels pending or confirmed bookings', async () => {
    await expect(reservations.cancel('BK-0037')).rejects.toMatchObject({ status: 409, message: 'BK-0037 is cancelled and cannot be cancelled. It is already cancelled.' })
    await expect(reservations.cancel('BK-0013')).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/check them out instead/) })
    await expect(reservations.cancel('BK-9999')).rejects.toMatchObject({ status: 404 })
  })
})

describe('reservation details', () => {
  it('includes guest contact, GST quote and payments', async () => {
    const details = await reservations.get('BK-0001')
    expect(details).toMatchObject({
      guestName: 'Aarav Mehta',
      guestEmail: 'aarav.mehta@example.com',
      roomNumber: '107',
      quote: { nights: 2, roomCharges: 7000, gstPercent: 12, gstAmount: 840, total: 7840 },
      amountPaid: 9341.5,
    })
    expect(details.payments.map((p) => p.id)).toEqual(['PAY-0001'])
  })
})
