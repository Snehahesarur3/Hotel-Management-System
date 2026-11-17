import type { MockDatabase } from '@/mock/seed'
import type { ISODate, Payment, Reservation } from '@/types/domain'
import { BOOKING_SOURCES, BOOKING_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, ROOM_TYPES, type BookingStatus } from '@/types/enums'
import type {
  ChargesBreakdown,
  GuestReport,
  GuestReportRow,
  NationalityRow,
  OccupancyNight,
  OccupancyReport,
  PaymentReport,
  ReportGrouping,
  ReportRange,
  ReservationReport,
  RevenueReport,
  RevenueReportQuery,
  RevenueShare,
  RoomPerformance,
} from '@/types/reports'
import { addDays, diffDays } from '@/utils/date'
import { roundMoney, sumMoney } from '@/utils/money'
import { calculateStayBill, paymentRecords } from './billing'
import { nightsOf, stayAmount, toReservationSummary } from './dashboard'

/**
 * Pure report calculations over the mock database (GET /api/reports/*).
 * Ranges are inclusive yyyy-MM-dd dates and are validated by the service before they get here.
 *
 * - Revenue and payments are a cash view: payments by payment date, refunds (negative payments) netted off.
 * - Occupancy counts room nights: a night belongs to its start date. Past nights count stays that happened;
 *   tonight onwards also counts confirmed and pending bookings.
 * - Reservations and guests are selected by arrival (check-in) date.
 * - "Room revenue" is the nightly rate x nights, before discounts and tax.
 */

const STAYED: BookingStatus[] = ['CHECKED_IN', 'CHECKED_OUT']
const UPCOMING: BookingStatus[] = ['PENDING', 'CONFIRMED']

/** part / whole as a percentage with one decimal (0 when whole is 0). */
const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10)
/** Average with one decimal (0 for an empty set). */
const average = (total: number, count: number) => (count === 0 ? 0 : Math.round((total / count) * 10) / 10)
const perUnit = (amount: number, units: number) => (units === 0 ? 0 : roundMoney(amount / units))

const inRange = (date: string, range: ReportRange) => {
  const day = date.slice(0, 10)
  return day >= range.from && day <= range.to
}

/** Every date in an inclusive range, oldest first. */
export function datesIn(range: ReportRange): ISODate[] {
  return Array.from({ length: diffDays(range.from, range.to) + 1 }, (_, i) => addDays(range.from, i))
}

export function periodKey(date: ISODate, groupBy: ReportGrouping): string {
  return groupBy === 'DAY' ? date.slice(0, 10) : groupBy === 'MONTH' ? date.slice(0, 7) : date.slice(0, 4)
}

/** The period keys that overlap the range, oldest first. */
export function periodsIn(range: ReportRange, groupBy: ReportGrouping): string[] {
  return [...new Set(datesIn(range).map((d) => periodKey(d, groupBy)))]
}

const completedIn = (db: MockDatabase, range: ReportRange) =>
  db.payments.filter((p) => p.status === 'COMPLETED' && inRange(p.paymentDate, range))

function cashTotals(payments: Payment[]) {
  const collected = sumMoney(payments.filter((p) => p.amount > 0).map((p) => p.amount))
  const refunded = sumMoney(payments.filter((p) => p.amount < 0).map((p) => -p.amount))
  return { collected, refunded, net: roundMoney(collected - refunded), transactions: payments.length }
}

// ------------------------------------------------------------------ revenue

export function calculateRevenueReport(db: MockDatabase, query: RevenueReportQuery): RevenueReport {
  const payments = completedIn(db, query)
  const totals = cashTotals(payments)
  const reservations = new Map(db.reservations.map((r) => [r.id, r]))
  const rooms = new Map(db.rooms.map((r) => [r.id, r]))

  const periods = periodsIn(query, query.groupBy).map((period) => ({
    period,
    ...cashTotals(payments.filter((p) => periodKey(p.paymentDate, query.groupBy) === period)),
  }))

  const shares = <K extends string>(keys: readonly K[], keyOf: (p: Payment) => K | undefined): RevenueShare<K>[] =>
    keys
      .map((key) => {
        const own = payments.filter((p) => keyOf(p) === key)
        const net = sumMoney(own.map((p) => p.amount))
        return { key, net, transactions: own.length, share: percent(net, totals.net) }
      })
      .sort((a, b) => b.net - a.net)

  const bySource = shares(BOOKING_SOURCES, (p) => reservations.get(p.reservationId)?.source)
  const byRoomType = shares(ROOM_TYPES, (p) => {
    const reservation = reservations.get(p.reservationId)
    return reservation && rooms.get(reservation.roomId)?.type
  })

  const bills = db.reservations
    .filter((r) => r.status === 'CHECKED_OUT' && inRange(r.checkOut, query))
    .map((r) => calculateStayBill(db, r))
  const charges: ChargesBreakdown = {
    stays: bills.length,
    roomCharges: sumMoney(bills.map((b) => b.roomCharges)),
    discounts: sumMoney(bills.map((b) => b.discount)),
    foodCharges: sumMoney(bills.map((b) => b.foodCharges)),
    extraCharges: sumMoney(bills.map((b) => b.extraCharges)),
    tax: sumMoney(bills.flatMap((b) => [b.roomGst, b.foodGst, b.extraGst])),
    total: sumMoney(bills.map((b) => b.total)),
  }

  return {
    from: query.from,
    to: query.to,
    groupBy: query.groupBy,
    totals: { ...totals, averagePerDay: perUnit(totals.net, datesIn(query).length) },
    periods,
    bySource,
    byRoomType,
    charges,
  }
}

// ------------------------------------------------------------------ occupancy

/** Whether the booking holds its room on `night` (see the module comment for the rule). */
function holdsNight(r: Reservation, night: ISODate, today: ISODate): boolean {
  if (night < r.checkIn || night >= r.checkOut) return false
  return STAYED.includes(r.status) || (night >= today && UPCOMING.includes(r.status))
}

export function calculateOccupancyReport(db: MockDatabase, range: ReportRange, today: ISODate): OccupancyReport {
  const totalRooms = db.rooms.length
  const dates = datesIn(range)
  const candidates = db.reservations.filter((r) => r.checkIn <= range.to && r.checkOut > range.from && r.status !== 'CANCELLED')
  const perRoom = new Map(db.rooms.map((room) => [room.id, { nightsSold: 0, roomRevenue: 0, stays: new Set<string>() }]))

  const nights: OccupancyNight[] = dates.map((date) => {
    const sold = new Map<string, Reservation>()
    for (const r of candidates) if (holdsNight(r, date, today) && !sold.has(r.roomId)) sold.set(r.roomId, r)
    for (const [roomId, r] of sold) {
      const stats = perRoom.get(roomId)
      if (!stats) continue
      stats.nightsSold += 1
      stats.roomRevenue = roundMoney(stats.roomRevenue + r.roomRate)
      stats.stays.add(r.id)
    }
    return {
      date,
      occupiedRooms: sold.size,
      totalRooms,
      rate: percent(sold.size, totalRooms),
      roomRevenue: sumMoney([...sold.values()].map((r) => r.roomRate)),
      forecast: date >= today,
    }
  })

  const rooms: RoomPerformance[] = db.rooms
    .map((room) => {
      const stats = perRoom.get(room.id)!
      return {
        roomId: room.id,
        roomNumber: room.roomNumber,
        type: room.type,
        floor: room.floor,
        stays: stats.stays.size,
        nightsSold: stats.nightsSold,
        occupancyRate: percent(stats.nightsSold, dates.length),
        roomRevenue: stats.roomRevenue,
        averageDailyRate: perUnit(stats.roomRevenue, stats.nightsSold),
      }
    })
    .sort((a, b) => b.nightsSold - a.nightsSold || b.roomRevenue - a.roomRevenue || a.roomNumber.localeCompare(b.roomNumber))

  const byRoomType = ROOM_TYPES.map((type) => {
    const ofType = rooms.filter((r) => r.type === type)
    const roomNightsAvailable = ofType.length * dates.length
    const roomNightsSold = ofType.reduce((n, r) => n + r.nightsSold, 0)
    const roomRevenue = sumMoney(ofType.map((r) => r.roomRevenue))
    return {
      type,
      rooms: ofType.length,
      roomNightsAvailable,
      roomNightsSold,
      occupancyRate: percent(roomNightsSold, roomNightsAvailable),
      roomRevenue,
      averageDailyRate: perUnit(roomRevenue, roomNightsSold),
      revPar: perUnit(roomRevenue, roomNightsAvailable),
    }
  })

  const roomNightsAvailable = totalRooms * dates.length
  const roomNightsSold = nights.reduce((n, night) => n + night.occupiedRooms, 0)
  const roomRevenue = sumMoney(nights.map((n) => n.roomRevenue))
  return {
    from: range.from,
    to: range.to,
    totals: {
      nights: dates.length,
      roomNightsAvailable,
      roomNightsSold,
      occupancyRate: percent(roomNightsSold, roomNightsAvailable),
      roomRevenue,
      averageDailyRate: perUnit(roomRevenue, roomNightsSold),
      revPar: perUnit(roomRevenue, roomNightsAvailable),
      forecastFrom: nights.find((n) => n.forecast)?.date ?? null,
    },
    nights,
    byRoomType,
    rooms,
  }
}

// ------------------------------------------------------------------ reservations

const leadTimeDays = (r: Reservation) => Math.max(0, diffDays(r.createdAt.slice(0, 10), r.checkIn))

export function calculateReservationReport(db: MockDatabase, range: ReportRange): ReservationReport {
  const arriving = db.reservations
    .filter((r) => inRange(r.checkIn, range))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.id.localeCompare(b.id))
  const live = arriving.filter((r) => r.status !== 'CANCELLED')
  const roomType = new Map(db.rooms.map((r) => [r.id, r.type]))
  const roomNights = live.reduce((n, r) => n + nightsOf(r), 0)

  return {
    from: range.from,
    to: range.to,
    totals: {
      reservations: arriving.length,
      cancelled: arriving.length - live.length,
      cancellationRate: percent(arriving.length - live.length, arriving.length),
      roomNights,
      roomRevenue: sumMoney(live.map(stayAmount)),
      averageStay: average(roomNights, live.length),
      averageLeadTime: average(live.reduce((n, r) => n + leadTimeDays(r), 0), live.length),
      averageGuests: average(live.reduce((n, r) => n + r.numberOfGuests, 0), live.length),
    },
    byStatus: BOOKING_STATUSES.map((key) => ({ key, count: arriving.filter((r) => r.status === key).length })),
    bySource: BOOKING_SOURCES.map((key) => {
      const own = arriving.filter((r) => r.source === key)
      const ownLive = own.filter((r) => r.status !== 'CANCELLED')
      return {
        key,
        reservations: own.length,
        cancelled: own.length - ownLive.length,
        roomNights: ownLive.reduce((n, r) => n + nightsOf(r), 0),
        roomRevenue: sumMoney(ownLive.map(stayAmount)),
      }
    }).sort((a, b) => b.reservations - a.reservations || b.roomRevenue - a.roomRevenue),
    byRoomType: ROOM_TYPES.map((key) => {
      const own = live.filter((r) => roomType.get(r.roomId) === key)
      return { key, reservations: own.length, roomNights: own.reduce((n, r) => n + nightsOf(r), 0), roomRevenue: sumMoney(own.map(stayAmount)) }
    }),
    rows: arriving.map((r) => toReservationSummary(db, r)),
  }
}

// ------------------------------------------------------------------ guests

export function calculateGuestReport(db: MockDatabase, range: ReportRange): GuestReport {
  const stays = db.reservations.filter((r) => r.status !== 'CANCELLED' && inRange(r.checkIn, range))
  const guests = new Map(db.guests.map((g) => [g.id, g]))
  const byGuest = new Map<string, Reservation[]>()
  for (const r of stays) byGuest.set(r.guestId, [...(byGuest.get(r.guestId) ?? []), r])

  const rows: GuestReportRow[] = [...byGuest].map(([guestId, own]) => {
    const guest = guests.get(guestId)
    return {
      guestId,
      guestName: guest?.fullName ?? 'Unknown guest',
      nationality: guest?.nationality ?? 'Unknown',
      stays: own.length,
      nights: own.reduce((n, r) => n + nightsOf(r), 0),
      roomRevenue: sumMoney(own.map(stayAmount)),
      lastArrival: own.map((r) => r.checkIn).sort().at(-1)!,
      isNew: guest ? inRange(guest.registrationDate, range) : false,
      isReturning: db.reservations.some((r) => r.guestId === guestId && STAYED.includes(r.status) && r.checkIn < range.from),
    }
  })
  rows.sort((a, b) => b.roomRevenue - a.roomRevenue || a.guestName.localeCompare(b.guestName))

  const nationalities = new Map<string, NationalityRow>()
  for (const row of rows) {
    const entry = nationalities.get(row.nationality) ?? { key: row.nationality, guests: 0, stays: 0, nights: 0, roomRevenue: 0 }
    entry.guests += 1
    entry.stays += row.stays
    entry.nights += row.nights
    entry.roomRevenue = roundMoney(entry.roomRevenue + row.roomRevenue)
    nationalities.set(row.nationality, entry)
  }

  const roomRevenue = sumMoney(rows.map((r) => r.roomRevenue))
  return {
    from: range.from,
    to: range.to,
    totals: {
      guests: rows.length,
      newGuests: rows.filter((r) => r.isNew).length,
      returningGuests: rows.filter((r) => r.isReturning).length,
      stays: stays.length,
      roomRevenue,
      averageRevenuePerGuest: perUnit(roomRevenue, rows.length),
    },
    byNationality: [...nationalities.values()].sort((a, b) => b.guests - a.guests || b.roomRevenue - a.roomRevenue || a.key.localeCompare(b.key)),
    guests: rows,
  }
}

// ------------------------------------------------------------------ payments

export function calculatePaymentReport(db: MockDatabase, range: ReportRange): PaymentReport {
  const all = db.payments.filter((p) => inRange(p.paymentDate, range))
  const completed = all.filter((p) => p.status === 'COMPLETED')
  const totals = cashTotals(completed)
  const ofStatus = (status: Payment['status']) => all.filter((p) => p.status === status)
  const ids = new Set(all.map((p) => p.id))

  return {
    from: range.from,
    to: range.to,
    totals: {
      transactions: all.length,
      collected: totals.collected,
      refunded: totals.refunded,
      net: totals.net,
      pendingCount: ofStatus('PENDING').length,
      pendingAmount: sumMoney(ofStatus('PENDING').map((p) => p.amount)),
      failedCount: ofStatus('FAILED').length,
      failedAmount: sumMoney(ofStatus('FAILED').map((p) => p.amount)),
    },
    byMethod: PAYMENT_METHODS.map((key) => {
      const own = cashTotals(completed.filter((p) => p.method === key))
      return { key, ...own, share: percent(own.net, totals.net) }
    }).sort((a, b) => b.net - a.net),
    byStatus: PAYMENT_STATUSES.map((key) => ({ key, count: ofStatus(key).length, amount: sumMoney(ofStatus(key).map((p) => p.amount)) })),
    rows: paymentRecords(db)
      .filter((p) => ids.has(p.id))
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id.localeCompare(a.id)),
  }
}
