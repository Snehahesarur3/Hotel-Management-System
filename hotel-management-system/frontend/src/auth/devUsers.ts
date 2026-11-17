import type { UserRole } from '@/types/enums'

/**
 * DEVELOPMENT-ONLY demo accounts. NOT production authentication.
 *
 * They mirror app.security.dev-users in the backend's application.yml, so the same sign-in works in both
 * data modes. They are fixed, publicly documented demo values, not real credentials: in mock mode the browser
 * checks them itself, and the sign-in page lists them so anyone running the demo can pick a role.
 * Before deployment, replace this with a real identity provider and remove the list.
 */
export interface DevUser {
  username: string
  password: string
  role: UserRole
  /** What the role is for, shown on the sign-in page. */
  description: string
}

export const DEV_USERS: readonly DevUser[] = [
  { username: 'admin', password: 'admin123', role: 'ADMIN', description: 'Everything' },
  { username: 'manager', password: 'manager123', role: 'MANAGER', description: 'Everything, including discounts, refunds and reports' },
  { username: 'reception', password: 'reception123', role: 'RECEPTIONIST', description: 'Guests, bookings, check-in/out and billing' },
  { username: 'housekeeping', password: 'housekeeping123', role: 'HOUSEKEEPING', description: 'Cleaning tasks, room status and stock' },
  { username: 'restaurant', password: 'restaurant123', role: 'RESTAURANT', description: 'Menu, orders and stock' },
]
