import { describe, expect, it } from 'vitest'
import { buildDatabaseFromSeed, type MockDatabase } from '@/mock/seed'
import type { Reservation } from '@/types/domain'
import { sumMoney } from '@/utils/money'
import {
  calculateGuestReport,
  calculateOccupancyReport,
  calculatePaymentReport,
  calculateReservationReport,
  calculateRevenueReport,
  datesIn,
  periodsIn,
} from './reports'

const TODAY = '2026-11-11'
const LAST_30 = { from: '2026-10-13', to: TODAY }
const freshDb = () => buildDatabaseFromSeed(TODAY)

function addStay(db: MockDatabase, stay: Partial<Reservation> & Pick<Reservation, 'checkIn' | 'checkOut' | 'status'>) {
  const reservation: Reservation = {
    id: `BK-T${db.reservations.length}`,
    guestId: 'GST-0001',
    roomId: 'RM-101',
    numberOfGuests: 2,
    roomRate: 4000,
    source: 'WEBSITE',
    createdAt: '2026-09-01T10:00:00',
    ...stay,
  }
  db.reservations.push(reservation)
  return reservation
}

describe('report periods', () => {
  it('lists every date and period that overlaps the range', () => {
    expect(datesIn({ from: '2026-02-27', to: '2026-03-02' })).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
    expect(periodsIn({ from: '2026-10-30', to: '2026-12-01' }, 'MONTH')).toEqual(['2026-10', '2026-11', '2026-12'])
    expect(periodsIn({ from: '2025-12-31', to: '2026-01-01' }, 'YEAR')).toEqual(['2025', '2026'])
    expect(periodsIn(LAST_30, 'DAY')).toHaveLength(30)
  })
})

describe('revenue report', () => {
  it('sums completed payments by period, including empty periods', () => {
    const report = calculateRevenueReport(freshDb(), { ...LAST_30, groupBy: 'MONTH' })
    expect(report.totals).toEqual({ collected: 157265.5, refunded: 0, net: 157265.5, transactions: 15, averagePerDay: 5242.18 })
    expect(report.periods.map((p) => p.period)).toEqual(['2026-10', '2026-11'])
    expect(sumMoney(report.periods.map((p) => p.net))).toBe(report.totals.net)

    const daily = calculateRevenueReport(freshDb(), { ...LAST_30, groupBy: 'DAY' })
    expect(daily.periods).toHaveLength(30)
    expect(daily.periods.some((p) => p.net === 0 && p.transactions === 0)).toBe(true)
  })

  it('nets refunds off and ignores pending and failed payments', () => {
    const db = freshDb()
    db.payments.push({
      id: 'PAY-T1',
      reservationId: 'BK-0001',
      amount: -1500,
      method: 'CASH',
      paymentDate: `${TODAY}T09:00:00`,
      status: 'COMPLETED',
      transactionReference: 'CASH-RFD-T1',
    })
    const report = calculateRevenueReport(db, { ...LAST_30, groupBy: 'DAY' })
    expect(report.totals).toMatchObject({ collected: 157265.5, refunded: 1500, net: 155765.5, transactions: 16 })
    expect(report.periods.at(-1)!.refunded).toBe(1500)
  })

  it('splits revenue by booking source and room type with shares of the net', () => {
    const report = calculateRevenueReport(freshDb(), { ...LAST_30, groupBy: 'MONTH' })
    expect(report.bySource[0]).toEqual({ key: 'CORPORATE', net: 38400, transactions: 3, share: 24.4 })
    expect(report.bySource).toHaveLength(7)
    expect(sumMoney(report.bySource.map((s) => s.net))).toBe(report.totals.net)
    expect(report.byRoomType.map((r) => r.key)).toEqual(['EXECUTIVE', 'STANDARD', 'DELUXE', 'SUITE', 'PRESIDENTIAL'])
    expect(sumMoney(report.byRoomType.map((r) => r.net))).toBe(report.totals.net)
  })

  it('totals the folio charges of stays checked out in the range', () => {
    const { charges } = calculateRevenueReport(freshDb(), { ...LAST_30, groupBy: 'MONTH' })
    expect(charges).toEqual({ stays: 6, roomCharges: 89000, discounts: 0, foodCharges: 4710, extraCharges: 0, tax: 13795.5, total: 107505.5 })
    expect(sumMoney([charges.roomCharges, -charges.discounts, charges.foodCharges, charges.extraCharges, charges.tax])).toBe(charges.total)
  })
})

describe('occupancy report', () => {
  it('counts room nights sold, ADR and RevPAR', () => {
    const report = calculateOccupancyReport(freshDb(), LAST_30, TODAY)
    expect(report.totals).toEqual({
      nights: 30,
      roomNightsAvailable: 1500,
      roomNightsSold: 60,
      occupancyRate: 4,
      roomRevenue: 435500,
      averageDailyRate: 7258.33,
      revPar: 290.33,
      forecastFrom: TODAY,
    })
    expect(report.nights.at(-1)).toEqual({ date: TODAY, occupiedRooms: 14, totalRooms: 50, rate: 28, roomRevenue: 112000, forecast: true })
    // Per room and per type figures add up to the totals.
    expect(report.rooms).toHaveLength(50)
    expect(report.rooms.reduce((n, r) => n + r.nightsSold, 0)).toBe(60)
    expect(report.byRoomType.reduce((n, t) => n + t.roomNightsAvailable, 0)).toBe(1500)
    expect(sumMoney(report.byRoomType.map((t) => t.roomRevenue))).toBe(435500)
    expect(report.rooms[0]).toMatchObject({ roomNumber: '306', nightsSold: 5, occupancyRate: 16.7 })
  })

  it('counts upcoming bookings only from tonight and never cancellations or no-shows', () => {
    const db = freshDb()
    const range = { from: '2026-12-20', to: '2026-12-24' }
    const before = calculateOccupancyReport(db, range, TODAY).totals.roomNightsSold
    addStay(db, { checkIn: '2026-12-20', checkOut: '2026-12-22', status: 'CONFIRMED' })
    addStay(db, { checkIn: '2026-12-21', checkOut: '2026-12-23', status: 'CANCELLED', roomId: 'RM-102' })
    expect(calculateOccupancyReport(db, range, TODAY).totals.roomNightsSold).toBe(before + 2)

    // A confirmed booking in the past that never checked in is a no-show.
    const past = { from: '2026-09-01', to: '2026-09-05' }
    const pastBefore = calculateOccupancyReport(db, past, TODAY).totals
    addStay(db, { checkIn: '2026-09-01', checkOut: '2026-09-03', status: 'CONFIRMED' })
    const pastAfter = calculateOccupancyReport(db, past, TODAY).totals
    expect(pastAfter.roomNightsSold).toBe(pastBefore.roomNightsSold)
    expect(pastAfter.forecastFrom).toBeNull()
  })
})

describe('reservation report', () => {
  it('summarises bookings arriving in the range', () => {
    const report = calculateReservationReport(freshDb(), LAST_30)
    expect(report.totals).toEqual({
      reservations: 25,
      cancelled: 2,
      cancellationRate: 8,
      roomNights: 77,
      roomRevenue: 583500,
      averageStay: 3.3,
      averageLeadTime: 18,
      averageGuests: 2,
    })
    expect(report.byStatus.reduce((n, s) => n + s.count, 0)).toBe(25)
    expect(report.bySource.reduce((n, s) => n + s.reservations, 0)).toBe(25)
    expect(report.bySource[0]).toMatchObject({ key: 'WEBSITE', reservations: 6 })
    expect(report.byRoomType.reduce((n, t) => n + t.roomNights, 0)).toBe(77)
    expect(report.rows).toHaveLength(25)
    const arrivals = report.rows.map((r) => r.checkIn)
    expect(arrivals).toEqual([...arrivals].sort())
  })
})

describe('guest report', () => {
  it('ranks guests by room revenue and groups them by nationality', () => {
    const report = calculateGuestReport(freshDb(), LAST_30)
    expect(report.totals).toMatchObject({ guests: 21, stays: 23, roomRevenue: 583500, averageRevenuePerGuest: 27785.71 })
    expect(report.guests[0]).toMatchObject({ guestName: 'Omar Haddad', nationality: 'Emirati', nights: 6, roomRevenue: 150000 })
    expect(report.byNationality[0]).toEqual({ key: 'Indian', guests: 13, stays: 15, nights: 45, roomRevenue: 250500 })
    expect(report.byNationality.reduce((n, r) => n + r.guests, 0)).toBe(21)
  })

  it('flags new guests and guests returning after an earlier stay', () => {
    const db = freshDb()
    const omar = db.guests.find((g) => g.fullName === 'Omar Haddad')!
    omar.registrationDate = '2026-11-01'
    const kenji = db.guests.find((g) => g.fullName === 'Kenji Watanabe')!
    addStay(db, { guestId: kenji.id, checkIn: '2026-06-01', checkOut: '2026-06-03', status: 'CHECKED_OUT' })
    const report = calculateGuestReport(db, LAST_30)
    expect(report.totals).toMatchObject({ newGuests: 1, returningGuests: 1 })
    expect(report.guests.find((g) => g.guestId === omar.id)).toMatchObject({ isNew: true, isReturning: false })
    expect(report.guests.find((g) => g.guestId === kenji.id)).toMatchObject({ isNew: false, isReturning: true })
  })
})

describe('payment report', () => {
  it('breaks payments down by method and status', () => {
    const report = calculatePaymentReport(freshDb(), LAST_30)
    expect(report.totals).toEqual({
      transactions: 18,
      collected: 157265.5,
      refunded: 0,
      net: 157265.5,
      pendingCount: 1,
      pendingAmount: 25000,
      failedCount: 1,
      failedAmount: 6160,
    })
    expect(report.byMethod[0]).toMatchObject({ key: 'CREDIT_CARD', net: 47741.5, share: 30.4 })
    expect(sumMoney(report.byMethod.map((m) => m.net))).toBe(report.totals.net)
    expect(report.byStatus.reduce((n, s) => n + s.count, 0)).toBe(18)
    expect(report.rows).toHaveLength(18)
    expect(report.rows[0]!.paymentDate >= report.rows.at(-1)!.paymentDate).toBe(true)
    expect(report.rows[0]).toHaveProperty('guestName')
  })
})
