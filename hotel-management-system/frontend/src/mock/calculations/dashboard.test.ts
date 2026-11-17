import { describe, expect, it } from 'vitest'
import { buildDatabaseFromSeed } from '@/mock/seed'
import {
  calculateDashboardSummary,
  calculateOccupancySeries,
  calculateRevenueSeries,
  nightsOf,
  stayAmount,
} from './dashboard'

const TODAY = '2026-11-11'
const freshDb = () => buildDatabaseFromSeed(TODAY)

describe('dashboard KPIs from the seed', () => {
  const summary = calculateDashboardSummary(freshDb(), TODAY)

  it('counts rooms by status', () => {
    expect(summary.kpis).toMatchObject({
      totalRooms: 50,
      availableRooms: 29,
      occupiedRooms: 14,
      reservedRooms: 3,
      cleaningRooms: 2,
      maintenanceRooms: 2,
    })
    expect(summary.kpis.occupancyRate).toBe(28)
  })

  it("derives today's arrivals and departures from reservation dates and statuses", () => {
    expect(summary.kpis.todaysCheckIns).toBe(4)
    expect(summary.todaysCheckIns.map((r) => r.guestName)).toEqual(
      expect.arrayContaining(['Aditya Saxena', 'Dev Bhatia', 'Amelia Clarke', 'Diya Raman']),
    )
    expect(summary.kpis.todaysCheckOuts).toBe(5)
    expect(summary.todaysCheckOuts.map((r) => r.id).sort()).toEqual(['BK-0001', 'BK-0002', 'BK-0015', 'BK-0016', 'BK-0020'])
  })

  it('sums only completed payments as revenue', () => {
    expect(summary.kpis.totalRevenue).toBe(287095.5)
  })

  it('breaks down booking sources (excluding cancellations) and room types', () => {
    const sources = Object.fromEntries(summary.bookingSources.map((s) => [s.key, s.count]))
    expect(sources).toEqual({ WEBSITE: 10, PHONE: 6, CORPORATE: 6, BOOKING_COM: 5, EXPEDIA: 4, AGODA: 3, WALK_IN: 2 })
    expect(summary.bookingSources[0]?.key).toBe('WEBSITE')
    expect(summary.roomTypes.reduce((sum, t) => sum + t.total, 0)).toBe(50)
    expect(summary.roomTypes.reduce((sum, t) => sum + t.occupied, 0)).toBe(14)
  })

  it("summarises today's housekeeping and lists open tasks high-priority first", () => {
    const { housekeeping } = summary
    expect(housekeeping.pending + housekeeping.inProgress + housekeeping.completed).toBe(13)
    expect(housekeeping.openTasks).toHaveLength(housekeeping.pending + housekeeping.inProgress)
    expect(housekeeping.openTasks[0]?.roomNumber).toBe('107')
  })

  it('returns the five most recent reservations and transactions, newest first', () => {
    expect(summary.recentReservations).toHaveLength(5)
    const created = summary.recentReservations.map((r) => r.createdAt)
    expect([...created].sort().reverse()).toEqual(created)
    expect(summary.recentTransactions).toHaveLength(5)
    expect(summary.recentTransactions[0]?.paymentDate.startsWith(TODAY)).toBe(true)
  })
})

describe('dashboard KPIs react to data changes (nothing is hard-coded)', () => {
  it('updates room and occupancy figures when a room status changes', () => {
    const db = freshDb()
    const room = db.rooms.find((r) => r.status === 'AVAILABLE')!
    room.status = 'OCCUPIED'
    const { kpis } = calculateDashboardSummary(db, TODAY)
    expect(kpis.occupiedRooms).toBe(15)
    expect(kpis.availableRooms).toBe(28)
    expect(kpis.occupancyRate).toBe(30)
  })

  it('excludes cancelled arrivals and adds new completed payments to revenue', () => {
    const db = freshDb()
    db.reservations.find((r) => r.id === 'BK-0027')!.status = 'CANCELLED'
    db.payments.push({
      id: 'PAY-9999',
      reservationId: 'BK-0027',
      amount: 1000.25,
      method: 'UPI',
      paymentDate: `${TODAY}T07:00:00`,
      status: 'COMPLETED',
      transactionReference: 'TEST',
    })
    const { kpis } = calculateDashboardSummary(db, TODAY)
    expect(kpis.todaysCheckIns).toBe(3)
    expect(kpis.totalRevenue).toBe(288095.75)
  })

  it('handles an empty hotel without dividing by zero', () => {
    const db = { ...freshDb(), rooms: [], reservations: [], payments: [], housekeepingTasks: [] }
    const { kpis, housekeeping } = calculateDashboardSummary(db, TODAY)
    expect(kpis.occupancyRate).toBe(0)
    expect(kpis.totalRevenue).toBe(0)
    expect(housekeeping.openTasks).toEqual([])
  })
})

describe('revenue and occupancy series', () => {
  it('buckets completed payments per day for the last 7 days and per month for 6 months', () => {
    const { daily, monthly } = calculateRevenueSeries(freshDb(), TODAY)
    expect(daily).toHaveLength(7)
    expect(daily.at(-1)).toEqual({ period: TODAY, amount: 36417.5 })
    expect(daily[0]?.period).toBe('2026-11-05')
    expect(monthly.map((m) => m.period)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(monthly.reduce((sum, m) => sum + m.amount, 0)).toBeCloseTo(287095.5, 2)
  })

  it('counts rooms occupied per night, ending last night', () => {
    const { nights } = calculateOccupancySeries(freshDb(), TODAY, 30)
    expect(nights).toHaveLength(30)
    expect(nights.at(-1)).toMatchObject({ date: '2026-11-10', occupiedRooms: 15, totalRooms: 50, rate: 30 })
  })

  it('computes nights and room charges for a stay', () => {
    const stay = { checkIn: '2026-11-09', checkOut: '2026-11-12', roomRate: 5500 }
    expect(nightsOf(stay)).toBe(3)
    expect(stayAmount({ ...freshDb().reservations[0]!, ...stay })).toBe(16500)
  })
})
