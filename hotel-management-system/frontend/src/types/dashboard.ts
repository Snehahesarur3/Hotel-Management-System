import type {
  BookingSource,
  BookingStatus,
  HousekeepingStatus,
  HousekeepingTaskType,
  PaymentMethod,
  PaymentStatus,
  RoomType,
  TaskPriority,
} from './enums'
import type { ISODate, ISODateTime } from './domain'

/**
 * Response shapes of GET /api/dashboard/summary, /revenue and /occupancy.
 * Produced by the mock calculations in mock mode and by the backend otherwise.
 */
export interface DashboardKpis {
  totalRooms: number
  availableRooms: number
  occupiedRooms: number
  reservedRooms: number
  cleaningRooms: number
  maintenanceRooms: number
  todaysCheckIns: number
  todaysCheckOuts: number
  /** Sum of COMPLETED payments, all time. */
  totalRevenue: number
  /** Sum of COMPLETED payments in the current calendar month. */
  revenueThisMonth: number
  /** Occupied rooms / total rooms x 100, one decimal. */
  occupancyRate: number
}

export interface ReservationSummary {
  id: string
  guestId: string
  guestName: string
  roomId: string
  roomNumber: string
  roomType: RoomType
  checkIn: ISODate
  checkOut: ISODate
  nights: number
  numberOfGuests: number
  totalAmount: number
  source: BookingSource
  status: BookingStatus
  createdAt: ISODateTime
}

export interface TransactionSummary {
  id: string
  reservationId: string
  guestName: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paymentDate: ISODateTime
}

export interface HousekeepingTaskSummary {
  id: string
  roomNumber: string
  taskType: HousekeepingTaskType
  priority: TaskPriority
  scheduledDate: ISODate
  assignee: string
  status: HousekeepingStatus
}

export interface HousekeepingOverview {
  /** Counts for tasks scheduled today. */
  pending: number
  inProgress: number
  completed: number
  /** Today's tasks that are not completed, high priority first. */
  openTasks: HousekeepingTaskSummary[]
}

export interface CategoryCount<K extends string> {
  key: K
  count: number
}

export interface RoomTypeBreakdown {
  type: RoomType
  total: number
  occupied: number
}

export interface DashboardSummary {
  asOf: ISODate
  kpis: DashboardKpis
  bookingSources: CategoryCount<BookingSource>[]
  roomTypes: RoomTypeBreakdown[]
  housekeeping: HousekeepingOverview
  recentReservations: ReservationSummary[]
  todaysCheckIns: ReservationSummary[]
  todaysCheckOuts: ReservationSummary[]
  recentTransactions: TransactionSummary[]
}

export interface RevenuePoint {
  /** yyyy-MM-dd for daily points, yyyy-MM for monthly points. */
  period: string
  amount: number
}

export interface RevenueSeries {
  /** Last 7 days including today. */
  daily: RevenuePoint[]
  /** Last 6 calendar months including the current one. */
  monthly: RevenuePoint[]
}

export interface OccupancyPoint {
  date: ISODate
  occupiedRooms: number
  totalRooms: number
  /** Percentage, one decimal. */
  rate: number
}

export interface OccupancySeries {
  /** One point per night, oldest first, ending last night. */
  nights: OccupancyPoint[]
}
