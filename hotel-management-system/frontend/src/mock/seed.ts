import guestsJson from '@seed/guests.json'
import housekeepingJson from '@seed/housekeeping-tasks.json'
import inventoryJson from '@seed/inventory.json'
import menuJson from '@seed/menu-items.json'
import paymentsJson from '@seed/payments.json'
import reservationsJson from '@seed/reservations.json'
import ordersJson from '@seed/restaurant-orders.json'
import roomsJson from '@seed/rooms.json'
import settingsJson from '@seed/settings.json'
import staffJson from '@seed/staff.json'
import type {
  BillAdjustment,
  Guest,
  HotelSettings,
  HousekeepingTask,
  InventoryItem,
  ISODate,
  MenuItem,
  Payment,
  Reservation,
  RestaurantOrder,
  Room,
  StaffMember,
  StockMovement,
} from '@/types/domain'
import { resolveDateTokens } from '@/utils/date'

/** The complete mock dataset, with all date tokens resolved to real dates. */
export interface MockDatabase {
  /** The date the seed was resolved against. */
  seededOn: ISODate
  settings: HotelSettings
  rooms: Room[]
  guests: Guest[]
  reservations: Reservation[]
  payments: Payment[]
  staff: StaffMember[]
  menuItems: MenuItem[]
  restaurantOrders: RestaurantOrder[]
  inventory: InventoryItem[]
  housekeepingTasks: HousekeepingTask[]
  /** Extra charges and discounts posted to folios (none in the seed). */
  billAdjustments: BillAdjustment[]
  /** Inventory stock-in / stock-out history (none in the seed). */
  stockMovements: StockMovement[]
}

/**
 * Builds a fresh database from the canonical seed in shared/seed.
 * JSON imports are typed loosely by TypeScript; the seed integrity test (seed.test.ts)
 * verifies every enum value and reference, which is what makes these casts safe.
 */
export function buildDatabaseFromSeed(today: ISODate): MockDatabase {
  const resolve = <T>(data: unknown) => resolveDateTokens(data, today) as T
  return {
    seededOn: today,
    settings: settingsJson as HotelSettings,
    rooms: resolve<Room[]>(roomsJson),
    guests: resolve<Guest[]>(guestsJson),
    reservations: resolve<Reservation[]>(reservationsJson),
    payments: resolve<Payment[]>(paymentsJson),
    staff: resolve<StaffMember[]>(staffJson),
    menuItems: resolve<MenuItem[]>(menuJson),
    restaurantOrders: resolve<RestaurantOrder[]>(ordersJson),
    inventory: resolve<InventoryItem[]>(inventoryJson),
    housekeepingTasks: resolve<HousekeepingTask[]>(housekeepingJson),
    billAdjustments: [],
    stockMovements: [],
  }
}
