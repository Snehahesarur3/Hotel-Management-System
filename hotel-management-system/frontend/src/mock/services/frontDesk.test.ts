import { beforeEach, describe, expect, it } from 'vitest'
import { calculateStayBill } from '@/mock/calculations/billing'
import { getDatabase, mutateDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import { addDays, todayISO } from '@/utils/date'
import { mockFrontDeskService as frontDesk } from './frontDesk'
import { mockReservationService as reservations } from './reservations'

const TODAY = todayISO()
const room = (id: string) => getDatabase().rooms.find((r) => r.id === id)!
const booking = (id: string) => getDatabase().reservations.find((r) => r.id === id)!

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('front desk overview', () => {
  it('lists today’s arrivals, in-house guests and due departures', async () => {
    const { date, arrivals, inHouse, departures } = await frontDesk.overview()
    expect(date).toBe(TODAY)
    expect(arrivals.map((r) => r.id).sort()).toEqual(['BK-0027', 'BK-0028', 'BK-0029'])
    expect(inHouse).toHaveLength(14)
    expect(departures.map((r) => r.id).sort()).toEqual(['BK-0015', 'BK-0016', 'BK-0020'])
  })

  it('keeps late arrivals on the list until their departure date', async () => {
    mutateDatabase((db) => {
      const stay = db.reservations.find((r) => r.id === 'BK-0030')!
      stay.checkIn = addDays(TODAY, -1)
    })
    const { arrivals } = await frontDesk.overview()
    expect(arrivals[0]!.id).toBe('BK-0030')
    expect((await frontDesk.checkInPreview('BK-0030')).lateArrival).toBe(true)
  })
})

describe('check-in', () => {
  it('previews the ID type on file (not the number) and the booked room first', async () => {
    const preview = await frontDesk.checkInPreview('BK-0027')
    expect(preview.idProofType).toBe('DRIVING_LICENSE')
    expect(JSON.stringify(preview)).not.toContain('5607')
    expect(preview.rooms[0]).toMatchObject({ booked: true, ready: true, room: { id: 'RM-104' } })
    expect(preview.rooms.slice(1).every((o) => o.ready && o.room.capacity >= 2)).toBe(true)
    // Same category is offered first.
    expect(preview.rooms[1]!.room.type).toBe('STANDARD')
  })

  it('verifies the guest ID and occupies the room', async () => {
    await expect(frontDesk.checkIn('BK-0027', { roomId: 'RM-104', idLast4: '1234' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { idLast4: "Doesn't match the Driving License on file. Check the document again." },
    })
    const summary = await frontDesk.checkIn('BK-0027', { roomId: 'RM-104', idLast4: ' 56-07 ' })
    expect(summary.status).toBe('CHECKED_IN')
    expect(booking('BK-0027').checkedInAt).toMatch(new RegExp(`^${TODAY}T`))
    expect(room('RM-104').status).toBe('OCCUPIED')
  })

  it('moves the guest to another ready room at the booked rate', async () => {
    await frontDesk.checkIn('BK-0027', { roomId: 'RM-208', idLast4: '5607' })
    expect(booking('BK-0027')).toMatchObject({ roomId: 'RM-208', roomRate: 3500 })
    expect(room('RM-208').status).toBe('OCCUPIED')
    expect(room('RM-104').status).toBe('AVAILABLE') // no longer held
  })

  it('refuses rooms that are not ready', async () => {
    await expect(frontDesk.checkIn('BK-0027', { roomId: 'RM-107', idLast4: '5607' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { roomId: "Room 107 can't be assigned: being cleaned" },
    })
    await expect(frontDesk.checkIn('BK-0027', { roomId: 'RM-102', idLast4: '5607' })).rejects.toMatchObject({
      fieldErrors: { roomId: "Room 102 can't be assigned: previous guest has not checked out" },
    })
    // RM-104 is held for BK-0027, arriving today.
    await expect(frontDesk.checkIn('BK-0028', { roomId: 'RM-104', idLast4: '4377' })).rejects.toMatchObject({
      fieldErrors: { roomId: "Room 104 can't be assigned: booked for BK-0027" },
    })
  })

  it('only checks in pending or confirmed bookings on or after the arrival date', async () => {
    await expect(frontDesk.checkInPreview('BK-0030')).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Check-in opens on the arrival date/) })
    await expect(frontDesk.checkInPreview('BK-0013')).rejects.toMatchObject({ status: 409, message: 'BK-0013 is checked in and cannot be checked in' })
    await expect(frontDesk.checkInPreview('BK-9999')).rejects.toMatchObject({ status: 404 })
  })
})

describe('final bill', () => {
  it('reconciles every seeded checked-out stay to a zero balance', () => {
    const db = getDatabase()
    for (const stay of db.reservations.filter((r) => r.status === 'CHECKED_OUT')) {
      expect({ id: stay.id, balance: calculateStayBill(db, stay).balance }).toEqual({ id: stay.id, balance: 0 })
    }
  })

  it('bills an early departure for the nights used, with restaurant charges', async () => {
    // BK-0013: arrived 3 nights ago, booked until tomorrow, two restaurant orders, one-night advance paid.
    const bill = await frontDesk.checkOutPreview('BK-0013')
    expect(bill).toMatchObject({
      checkOut: TODAY,
      bookedCheckOut: addDays(TODAY, 1),
      nights: 3,
      roomCharges: 10500,
      roomGst: 1260,
      foodCharges: 2140,
      foodGst: 107,
      total: 14007,
      paid: 3920,
      balance: 10087,
    })
    expect(bill.lines.map((l) => l.kind)).toEqual(['ROOM', 'ROOM_GST', 'FOOD', 'FOOD_GST'])
    expect(bill.orders.map((o) => o.id)).toEqual(['ORD-0005', 'ORD-0006'])
  })

  it('ignores failed payments and cancelled orders', async () => {
    expect((await frontDesk.checkOutPreview('BK-0017')).paid).toBe(0) // advance was declined
    expect((await frontDesk.checkOutPreview('BK-0021')).orders.map((o) => o.id)).toEqual(['ORD-0010'])
  })
})

describe('check-out', () => {
  it('requires the balance to be settled, then records a mock payment', async () => {
    await expect(frontDesk.checkOut('BK-0013', {})).rejects.toMatchObject({
      status: 409,
      message: 'Collect the outstanding ₹10,087.00 before check-out',
      fieldErrors: { paymentMethod: 'Choose how the guest is paying' },
    })
    expect(booking('BK-0013').status).toBe('CHECKED_IN')

    const result = await frontDesk.checkOut('BK-0013', { paymentMethod: 'UPI' })
    expect(result.payment).toMatchObject({ amount: 10087, method: 'UPI', status: 'COMPLETED', transactionReference: expect.stringMatching(/^MOCK-TXN-\d{6}$/) })
    expect(result.bill.balance).toBe(0)
    expect(booking('BK-0013')).toMatchObject({ status: 'CHECKED_OUT', checkOut: TODAY })
    expect(room('RM-102').status).toBe('CLEANING')
  })

  it('sends the room to housekeeping, rushing it when someone arrives today', async () => {
    // BK-0015 leaves RM-108 today with nothing to pay; book a same-day arrival into that room first.
    await reservations.create({ guestId: 'GST-0002', roomId: 'RM-108', checkIn: TODAY, checkOut: addDays(TODAY, 1), numberOfGuests: 1, source: 'WALK_IN', status: 'CONFIRMED' })
    const result = await frontDesk.checkOut('BK-0015', {})
    expect(result.payment).toBeNull()
    const task = getDatabase().housekeepingTasks.find((t) => t.id === result.housekeepingTaskId)!
    expect(task).toMatchObject({ roomId: 'RM-108', taskType: 'CHECKOUT_CLEAN', priority: 'HIGH', status: 'PENDING', scheduledDate: TODAY })
    const housekeeping = getDatabase().staff.filter((s) => s.department === 'HOUSEKEEPING').map((s) => s.id)
    expect(housekeeping).toContain(task.assignedStaffId)
    expect(room('RM-108').status).toBe('CLEANING')
  })

  it('bills a same-day stay as one night and refuses stays that are not checked in', async () => {
    await frontDesk.checkIn('BK-0027', { roomId: 'RM-104', idLast4: '5607' })
    const bill = await frontDesk.checkOutPreview('BK-0027')
    expect(bill).toMatchObject({ checkOut: TODAY, nights: 1, total: 3920, balance: 3920 })
    const result = await frontDesk.checkOut('BK-0027', { paymentMethod: 'CASH' })
    expect(result.payment?.transactionReference).toMatch(/^CASH-\d{6}$/)

    await expect(frontDesk.checkOutPreview('BK-0027')).rejects.toMatchObject({ status: 409 })
    await expect(frontDesk.checkOut('BK-0030', {})).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/only checked-in stays/) })
  })
})
