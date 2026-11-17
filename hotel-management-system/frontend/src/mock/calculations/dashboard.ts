import type {
  DashboardSummary,
  HousekeepingTaskSummary,
  OccupancySeries,
  ReservationSummary,
  RevenueSeries,
  TransactionSummary,
} from '@/types/dashboard'
import type { HousekeepingTask, ISODate, Payment, Reservation } from '@/types/domain'
import { BOOKING_SOURCES, ROOM_TYPES, type BookingStatus, type TaskPriority } from '@/types/enums'
import type { MockDatabase } from '@/mock/seed'
import { addDays, diffDays, lastMonths, monthKey } from '@/utils/date'
import { roundMoney, sumMoney } from '@/utils/money'

/**
 * Pure dashboard calculations over the mock database.
 * Nothing here is hard-coded: every figure is derived from rooms, reservations, payments and tasks.
 * The backend implements the same rules for GET /api/dashboard/*.
 */

const ARRIVAL_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN']
const DEPARTURE_STATUSES: BookingStatus[] = ['CHECKED_IN', 'CHECKED_OUT']
/** Stays that physically used the room on a night. */
const STAYED_STATUSES: BookingStatus[] = ['CHECKED_IN', 'CHECKED_OUT']
export const PRIORITY_ORDER: Record<TaskPriority, number> = { HIGH: 0, NORMAL: 1, LOW: 2 }
const LIST_LIMIT = 5

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10)

export function nightsOf(reservation: Pick<Reservation, 'checkIn' | 'checkOut'>): number {
  return diffDays(reservation.checkIn, reservation.checkOut)
}

/** Room charges for the stay (rate x nights), before taxes and extras. */
export function stayAmount(reservation: Reservation): number {
  return roundMoney(reservation.roomRate * nightsOf(reservation))
}

export function completedRevenue(payments: Payment[], predicate: (p: Payment) => boolean = () => true): number {
  return sumMoney(payments.filter((p) => p.status === 'COMPLETED' && predicate(p)).map((p) => p.amount))
}

function lookups(db: MockDatabase) {
  return {
    room: new Map(db.rooms.map((r) => [r.id, r])),
    guest: new Map(db.guests.map((g) => [g.id, g])),
    reservation: new Map(db.reservations.map((r) => [r.id, r])),
    staff: new Map(db.staff.map((s) => [s.id, s])),
  }
}

export function toReservationSummary(db: MockDatabase, reservation: Reservation): ReservationSummary {
  const { room, guest } = lookups(db)
  const r = room.get(reservation.roomId)
  return {
    id: reservation.id,
    guestId: reservation.guestId,
    guestName: guest.get(reservation.guestId)?.fullName ?? 'Unknown guest',
    roomId: reservation.roomId,
    roomNumber: r?.roomNumber ?? '—',
    roomType: r?.type ?? 'STANDARD',
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    nights: nightsOf(reservation),
    numberOfGuests: reservation.numberOfGuests,
    totalAmount: stayAmount(reservation),
    source: reservation.source,
    status: reservation.status,
    createdAt: reservation.createdAt,
  }
}

export function toTaskSummary(db: MockDatabase, task: HousekeepingTask): HousekeepingTaskSummary {
  const { room, staff } = lookups(db)
  return {
    id: task.id,
    roomNumber: room.get(task.roomId)?.roomNumber ?? '—',
    taskType: task.taskType,
    priority: task.priority,
    scheduledDate: task.scheduledDate,
    assignee: staff.get(task.assignedStaffId)?.fullName ?? 'Unassigned',
    status: task.status,
  }
}

export function calculateDashboardSummary(db: MockDatabase, today: ISODate): DashboardSummary {
  const maps = lookups(db)
  const countRooms = (status: string) => db.rooms.filter((r) => r.status === status).length
  const occupiedRooms = countRooms('OCCUPIED')

  const arrivals = db.reservations
    .filter((r) => r.checkIn === today && ARRIVAL_STATUSES.includes(r.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const departures = db.reservations
    .filter((r) => r.checkOut === today && DEPARTURE_STATUSES.includes(r.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const liveReservations = db.reservations.filter((r) => r.status !== 'CANCELLED')
  const bookingSources = BOOKING_SOURCES.map((key) => ({
    key,
    count: liveReservations.filter((r) => r.source === key).length,
  })).sort((a, b) => b.count - a.count)

  const roomTypes = ROOM_TYPES.map((type) => {
    const ofType = db.rooms.filter((r) => r.type === type)
    return { type, total: ofType.length, occupied: ofType.filter((r) => r.status === 'OCCUPIED').length }
  })

  const todaysTasks = db.housekeepingTasks.filter((t) => t.scheduledDate === today)
  const openTasks = todaysTasks
    .filter((t) => t.status !== 'COMPLETED')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.id.localeCompare(b.id))
    .map((t) => toTaskSummary(db, t))

  const recentTransactions: TransactionSummary[] = [...db.payments]
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
    .slice(0, LIST_LIMIT)
    .map((p) => {
      const reservation = maps.reservation.get(p.reservationId)
      return {
        id: p.id,
        reservationId: p.reservationId,
        guestName: (reservation && maps.guest.get(reservation.guestId)?.fullName) ?? 'Unknown guest',
        amount: p.amount,
        method: p.method,
        status: p.status,
        paymentDate: p.paymentDate,
      }
    })

  const currentMonth = monthKey(today)
  return {
    asOf: today,
    kpis: {
      totalRooms: db.rooms.length,
      availableRooms: countRooms('AVAILABLE'),
      occupiedRooms,
      reservedRooms: countRooms('RESERVED'),
      cleaningRooms: countRooms('CLEANING'),
      maintenanceRooms: countRooms('MAINTENANCE'),
      todaysCheckIns: arrivals.length,
      todaysCheckOuts: departures.length,
      totalRevenue: completedRevenue(db.payments),
      revenueThisMonth: completedRevenue(db.payments, (p) => monthKey(p.paymentDate) === currentMonth),
      occupancyRate: percent(occupiedRooms, db.rooms.length),
    },
    bookingSources,
    roomTypes,
    housekeeping: {
      pending: todaysTasks.filter((t) => t.status === 'PENDING').length,
      inProgress: todaysTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      completed: todaysTasks.filter((t) => t.status === 'COMPLETED').length,
      openTasks,
    },
    recentReservations: [...db.reservations]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, LIST_LIMIT)
      .map((r) => toReservationSummary(db, r)),
    todaysCheckIns: arrivals.map((r) => toReservationSummary(db, r)),
    todaysCheckOuts: departures.map((r) => toReservationSummary(db, r)),
    recentTransactions,
  }
}

export function calculateRevenueSeries(db: MockDatabase, today: ISODate): RevenueSeries {
  const daily = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => ({
    period: date,
    amount: completedRevenue(db.payments, (p) => p.paymentDate.startsWith(date)),
  }))
  const monthly = lastMonths(today, 6).map((month) => ({
    period: month,
    amount: completedRevenue(db.payments, (p) => monthKey(p.paymentDate) === month),
  }))
  return { daily, monthly }
}

/** Rooms occupied on each of the last `nights` nights (a night belongs to its start date). */
export function calculateOccupancySeries(db: MockDatabase, today: ISODate, nights = 30): OccupancySeries {
  const totalRooms = db.rooms.length
  const stays = db.reservations.filter((r) => STAYED_STATUSES.includes(r.status))
  return {
    nights: Array.from({ length: nights }, (_, i) => addDays(today, i - nights)).map((date) => {
      const occupiedRooms = new Set(
        stays.filter((r) => r.checkIn <= date && date < r.checkOut).map((r) => r.roomId),
      ).size
      return { date, occupiedRooms, totalRooms, rate: percent(occupiedRooms, totalRooms) }
    }),
  }
}
