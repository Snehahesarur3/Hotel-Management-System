import type { ServiceProvider } from '@/api/types'
import { hasPermission, type Permission } from '@/auth/permissions'
import type { CurrentUser } from '@/auth/session'
import { ApiError } from '@/types/api'

/** The permission a call needs: fixed, or derived from its arguments (discounts depend on the request body). */
type Rule<F> = Permission | (F extends (...args: infer A) => unknown ? (...args: A) => Permission : never)

type GuardedModule = Exclude<keyof ServiceProvider, 'system' | 'auth'>

/** One rule per service method; a method without a rule is a type error. */
type AccessRules = { [S in GuardedModule]: { [M in keyof ServiceProvider[S]]: Rule<ServiceProvider[S][M]> } }

/**
 * The backend's access matrix (SecurityConfig.accessRules) expressed per service method,
 * so mock mode answers 401/403 exactly where the API would.
 */
export const ACCESS_RULES: AccessRules = {
  dashboard: { summary: 'dashboard.view', revenue: 'dashboard.view', occupancy: 'dashboard.view' },
  rooms: {
    list: 'rooms.view',
    get: 'rooms.view',
    floors: 'rooms.view',
    activity: 'rooms.view',
    create: 'rooms.manage',
    update: 'rooms.manage',
    updateStatus: 'rooms.status',
    remove: 'rooms.manage',
  },
  guests: {
    list: 'guests.view',
    get: 'guests.view',
    nationalities: 'guests.view',
    history: 'guests.view',
    create: 'guests.manage',
    update: 'guests.manage',
    remove: 'guests.delete',
  },
  reservations: {
    list: 'reservations.view',
    get: 'reservations.view',
    availability: 'reservations.view',
    create: 'reservations.manage',
    update: 'reservations.manage',
    cancel: 'reservations.manage',
  },
  frontDesk: {
    overview: 'frontDesk.overview',
    checkInPreview: 'frontDesk.view',
    checkIn: 'frontDesk.manage',
    checkOutPreview: 'frontDesk.view',
    checkOut: 'frontDesk.manage',
  },
  billing: {
    summary: 'billing.view',
    invoices: 'billing.view',
    invoice: 'billing.view',
    addAdjustment: (_reservationId, input) => (input.kind === 'DISCOUNT' ? 'billing.supervise' : 'billing.manage'),
    removeAdjustment: 'billing.supervise',
    recordPayment: 'billing.manage',
    refund: 'billing.supervise',
    payments: 'billing.view',
    updatePaymentStatus: 'billing.manage',
  },
  housekeeping: {
    list: 'housekeeping.view',
    summary: 'housekeeping.view',
    create: 'housekeeping.manage',
    update: 'housekeeping.manage',
    updateStatus: 'housekeeping.manage',
    remove: 'housekeeping.manage',
  },
  restaurant: {
    summary: 'restaurant.view',
    menu: 'restaurant.view',
    createMenuItem: 'restaurant.menu',
    updateMenuItem: 'restaurant.menu',
    setMenuItemAvailability: 'restaurant.menu',
    removeMenuItem: 'restaurant.menu',
    orders: 'restaurant.orders',
    createOrder: 'restaurant.orders',
    updateOrderStatus: 'restaurant.orders',
  },
  staff: {
    list: 'staff.view',
    summary: 'staff.view',
    get: 'staff.view',
    create: 'staff.manage',
    update: 'staff.manage',
    remove: 'staff.manage',
  },
  inventory: {
    list: 'inventory.view',
    summary: 'inventory.view',
    suppliers: 'inventory.view',
    movements: 'inventory.view',
    create: 'inventory.manage',
    update: 'inventory.manage',
    stockIn: 'inventory.stock',
    stockOut: 'inventory.stock',
    remove: 'inventory.manage',
  },
  reports: {
    revenue: 'reports.view',
    occupancy: 'reports.view',
    reservations: 'reports.view',
    guests: 'reports.view',
    payments: 'reports.view',
  },
  settings: { get: 'settings.view', update: 'settings.manage' },
}

/** Same messages as the backend's 401/403 responses. */
export const UNAUTHENTICATED_MESSAGE = 'Authentication required'
export const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action'

type AnyFunction = (...args: unknown[]) => Promise<unknown>

/**
 * Wraps the mock services so every call checks the signed-in user against {@link ACCESS_RULES}
 * before it runs, as the backend does. `system.health` and `auth` stay public.
 */
export function withAccessControl(services: ServiceProvider, currentUser: () => CurrentUser | null): ServiceProvider {
  const guarded: Record<string, unknown> = { ...services }
  for (const [moduleName, rules] of Object.entries(ACCESS_RULES) as [GuardedModule, Record<string, unknown>][]) {
    const target = services[moduleName] as unknown as Record<string, AnyFunction>
    guarded[moduleName] = Object.fromEntries(
      Object.entries(target).map(([method, fn]) => {
        const rule = rules[method] as Permission | ((...args: unknown[]) => Permission)
        const wrapped: AnyFunction = async (...args) => {
          const user = currentUser()
          if (!user) throw new ApiError(401, UNAUTHENTICATED_MESSAGE)
          const permission = typeof rule === 'function' ? rule(...args) : rule
          if (!hasPermission(user.roles, permission)) throw new ApiError(403, FORBIDDEN_MESSAGE)
          return fn(...args)
        }
        return [method, wrapped]
      }),
    )
  }
  return guarded as unknown as ServiceProvider
}
