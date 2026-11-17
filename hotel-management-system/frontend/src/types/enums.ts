/**
 * Domain enumerations. Values mirror the backend enums in com.hotel.enums exactly,
 * so payloads are interchangeable between mock mode and the Spring Boot API.
 */
export const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'EXECUTIVE', 'PRESIDENTIAL'] as const
export type RoomType = (typeof ROOM_TYPES)[number]

export const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE'] as const
export type RoomStatus = (typeof ROOM_STATUSES)[number]

export const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_SOURCES = ['WALK_IN', 'WEBSITE', 'PHONE', 'BOOKING_COM', 'EXPEDIA', 'AGODA', 'CORPORATE'] as const
export type BookingSource = (typeof BOOKING_SOURCES)[number]

export const PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'BANK_TRANSFER'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const HOUSEKEEPING_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number]

export const HOUSEKEEPING_TASK_TYPES = ['CHECKOUT_CLEAN', 'DAILY_SERVICE', 'DEEP_CLEAN', 'INSPECTION'] as const
export type HousekeepingTaskType = (typeof HOUSEKEEPING_TASK_TYPES)[number]

export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const DEPARTMENTS = ['RECEPTION', 'HOUSEKEEPING', 'RESTAURANT', 'MANAGEMENT', 'MAINTENANCE', 'SECURITY'] as const
export type Department = (typeof DEPARTMENTS)[number]

export const EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'INACTIVE'] as const
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]

export const ORDER_STATUSES = ['PLACED', 'PREPARING', 'SERVED', 'DELIVERED', 'CANCELLED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const MENU_CATEGORIES = ['BREAKFAST', 'STARTERS', 'MAIN_COURSE', 'DESSERTS', 'BEVERAGES'] as const
export type MenuCategory = (typeof MENU_CATEGORIES)[number]

export const ID_PROOF_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', 'VOTER_ID'] as const
export type IdProofType = (typeof ID_PROOF_TYPES)[number]

export const INVENTORY_CATEGORIES = [
  'LINEN',
  'TOILETRIES',
  'CLEANING_SUPPLIES',
  'FOOD_BEVERAGE',
  'MAINTENANCE',
  'OFFICE_SUPPLIES',
] as const
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]

export const STOCK_MOVEMENT_TYPES = ['STOCK_IN', 'STOCK_OUT'] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export const USER_ROLES = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'RESTAURANT'] as const
export type UserRole = (typeof USER_ROLES)[number]
