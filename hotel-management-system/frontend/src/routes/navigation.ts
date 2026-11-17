import {
  BarChart3,
  BedDouble,
  CalendarRange,
  ConciergeBell,
  CreditCard,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  UserCog,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/auth/permissions'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** One-line purpose, shown on the module page. */
  description: string
  /** Who sees the module in the sidebar and may open its pages. */
  permission: Permission
}

/** Single source of truth for the sidebar and the module routes. */
export const NAV_ITEMS: NavItem[] = [
  {
    path: '/',
    permission: 'dashboard.view',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Live overview of rooms, arrivals, departures, revenue and housekeeping.',
  },
  {
    path: '/rooms',
    permission: 'rooms.view',
    label: 'Rooms',
    icon: BedDouble,
    description: 'Room inventory, pricing, amenities and status.',
  },
  {
    path: '/reservations',
    permission: 'reservations.view',
    label: 'Reservations',
    icon: CalendarRange,
    description: 'Bookings, availability and cancellations.',
  },
  {
    path: '/guests',
    permission: 'guests.view',
    label: 'Guests',
    icon: Users,
    description: 'Guest profiles and booking history.',
  },
  {
    path: '/front-desk',
    permission: 'frontDesk.view',
    label: 'Check-in / Check-out',
    icon: ConciergeBell,
    description: 'Arrival and departure workflows.',
  },
  {
    path: '/housekeeping',
    permission: 'housekeeping.view',
    label: 'Housekeeping',
    icon: Sparkles,
    description: 'Cleaning schedule and task tracking.',
  },
  {
    path: '/restaurant',
    permission: 'restaurant.view',
    label: 'Restaurant',
    icon: UtensilsCrossed,
    description: 'Menu, room-service orders and guest charges.',
  },
  {
    path: '/billing',
    permission: 'billing.view',
    label: 'Billing & Payments',
    icon: CreditCard,
    description: 'Invoices, payments and outstanding balances.',
  },
  {
    path: '/staff',
    permission: 'staff.view',
    label: 'Staff',
    icon: UserCog,
    description: 'Employees, departments and employment status.',
  },
  {
    path: '/inventory',
    permission: 'inventory.view',
    label: 'Inventory',
    icon: Package,
    description: 'Stock levels, suppliers and low-stock alerts.',
  },
  {
    path: '/reports',
    permission: 'reports.view',
    label: 'Reports & Analytics',
    icon: BarChart3,
    description: 'Revenue, occupancy, reservation, guest and payment reports.',
  },
  {
    path: '/settings',
    permission: 'settings.view',
    label: 'Settings',
    icon: Settings,
    description: 'Hotel profile, taxes, user roles and demo data.',
  },
]

/**
 * The permission needed to open an in-app path: that of the module whose path it starts with
 * ('/billing/invoices/BK-0001' -> 'billing.view'). Undefined for paths outside the modules.
 */
export function permissionForPath(to: string): Permission | undefined {
  const path = to.split(/[?#]/)[0] ?? ''
  return NAV_ITEMS.filter((item) => (item.path === '/' ? path === '/' : path === item.path || path.startsWith(`${item.path}/`))).sort(
    (a, b) => b.path.length - a.path.length,
  )[0]?.permission
}
