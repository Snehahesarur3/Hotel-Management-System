import type { UserRole } from '@/types/enums'

/**
 * What each role may do. This is the frontend copy of the backend's access matrix
 * (backend SecurityConfig.accessRules), used to:
 *  - show only the modules and actions a signed-in user can use;
 *  - enforce the same rules in mock mode (src/mock/services/accessControl.ts), so both data sources behave alike.
 * The backend remains the authority when it is connected; the live API test checks the two agree.
 */
const ALL: readonly UserRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'RESTAURANT']
const MANAGEMENT: readonly UserRole[] = ['ADMIN', 'MANAGER']
const FRONT_OFFICE: readonly UserRole[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST']

export const PERMISSIONS = {
  'dashboard.view': ALL,

  'rooms.view': ALL,
  /** Create, edit and delete rooms. */
  'rooms.manage': MANAGEMENT,
  /** Set a room to Available, Cleaning or Maintenance. */
  'rooms.status': ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'],

  'guests.view': FRONT_OFFICE,
  'guests.manage': FRONT_OFFICE,
  'guests.delete': MANAGEMENT,

  'reservations.view': FRONT_OFFICE,
  'reservations.manage': FRONT_OFFICE,

  'frontDesk.view': FRONT_OFFICE,
  /** Today's arrivals, in-house guests and departures. Restaurant staff use it to charge orders to a room. */
  'frontDesk.overview': ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'RESTAURANT'],
  'frontDesk.manage': FRONT_OFFICE,

  'billing.view': FRONT_OFFICE,
  /** Record payments, confirm or fail pending ones, add extra charges. */
  'billing.manage': FRONT_OFFICE,
  /** Discounts, refunds and removing adjustments. */
  'billing.supervise': MANAGEMENT,

  'housekeeping.view': ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'],
  'housekeeping.manage': ['ADMIN', 'MANAGER', 'HOUSEKEEPING'],

  'restaurant.view': ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'RESTAURANT'],
  'restaurant.orders': ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'RESTAURANT'],
  'restaurant.menu': ['ADMIN', 'MANAGER', 'RESTAURANT'],

  'staff.view': MANAGEMENT,
  'staff.manage': MANAGEMENT,

  'inventory.view': ['ADMIN', 'MANAGER', 'HOUSEKEEPING', 'RESTAURANT'],
  /** Stock in and stock out. */
  'inventory.stock': ['ADMIN', 'MANAGER', 'HOUSEKEEPING', 'RESTAURANT'],
  /** Create, edit and delete items. */
  'inventory.manage': MANAGEMENT,

  'reports.view': MANAGEMENT,

  'settings.view': MANAGEMENT,
  /** Edit the hotel profile and check-in/check-out times. */
  'settings.manage': ['ADMIN'],
} as const satisfies Record<string, readonly UserRole[]>

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(roles: readonly UserRole[] | undefined, permission: Permission): boolean {
  if (!roles) return false
  const allowed: readonly UserRole[] = PERMISSIONS[permission]
  return roles.some((role) => allowed.includes(role))
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  RECEPTIONIST: 'Receptionist',
  HOUSEKEEPING: 'Housekeeping',
  RESTAURANT: 'Restaurant',
}
