import type { BillAdjustment } from './billing'
import type {
  BookingSource,
  BookingStatus,
  Department,
  EmploymentStatus,
  HousekeepingStatus,
  HousekeepingTaskType,
  IdProofType,
  InventoryCategory,
  MenuCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RoomStatus,
  RoomType,
  StockMovementType,
  TaskPriority,
} from './enums'

/** ISO local date, yyyy-MM-dd */
export type ISODate = string
/** ISO local date-time without zone, yyyy-MM-ddTHH:mm:ss */
export type ISODateTime = string

/** Stored entities. Derived values (nights, totals, guest names...) are computed by services. */

export interface Room {
  id: string
  roomNumber: string
  type: RoomType
  floor: number
  capacity: number
  pricePerNight: number
  amenities: string[]
  status: RoomStatus
  description: string
}

export interface Guest {
  id: string
  fullName: string
  email: string
  phone: string
  address: string
  nationality: string
  idProofType: IdProofType
  /** Masked placeholder; real document numbers are never stored. */
  idProofNumber: string
  registrationDate: ISODate
}

export interface Reservation {
  id: string
  guestId: string
  roomId: string
  checkIn: ISODate
  checkOut: ISODate
  numberOfGuests: number
  /** Nightly rate locked in at booking time. */
  roomRate: number
  source: BookingSource
  status: BookingStatus
  createdAt: ISODateTime
  /** Set by the front desk at check-in / check-out (absent on seed stays). */
  checkedInAt?: ISODateTime
  checkedOutAt?: ISODateTime
}

export interface Payment {
  id: string
  reservationId: string
  amount: number
  method: PaymentMethod
  paymentDate: ISODateTime
  status: PaymentStatus
  transactionReference: string
}

export interface StaffMember {
  id: string
  fullName: string
  email: string
  phone: string
  department: Department
  designation: string
  joiningDate: ISODate
  employmentStatus: EmploymentStatus
}

export interface MenuItem {
  id: string
  name: string
  category: MenuCategory
  price: number
  isVegetarian: boolean
  available: boolean
}

export interface OrderLine {
  menuItemId: string
  quantity: number
  unitPrice: number
}

export interface RestaurantOrder {
  id: string
  reservationId: string
  roomId: string
  items: OrderLine[]
  status: OrderStatus
  orderedAt: ISODateTime
}

export interface Supplier {
  name: string
  contactPerson: string
  phone: string
  email: string
}

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  unit: string
  quantity: number
  minStockLevel: number
  unitCost: number
  supplier: Supplier
  lastRestocked: ISODate
}

/** Every change to an inventory quantity is recorded as a movement (quantities are never edited directly). */
export interface StockMovement {
  id: string
  itemId: string
  type: StockMovementType
  /** Always positive; the type gives the direction. */
  quantity: number
  reason: string
  /** Stock on hand after this movement. */
  balanceAfter: number
  createdAt: ISODateTime
}

export interface HousekeepingTask {
  id: string
  roomId: string
  assignedStaffId: string
  taskType: HousekeepingTaskType
  priority: TaskPriority
  status: HousekeepingStatus
  scheduledDate: ISODate
  completedAt?: ISODateTime
  notes?: string
}

export type { BillAdjustment }

export interface GstSlab {
  /** Upper bound of the nightly rate for this slab; null = no upper bound. */
  maxRate: number | null
  percent: number
}

export interface HotelSettings {
  seedVersion: number
  hotel: { name: string; address: string; phone: string; email: string; gstin: string }
  currency: string
  timezone: string
  checkInTime: string
  checkOutTime: string
  taxes: { roomGstSlabs: GstSlab[]; foodGstPercent: number }
}
