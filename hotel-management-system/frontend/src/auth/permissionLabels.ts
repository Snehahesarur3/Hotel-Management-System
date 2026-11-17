import type { Permission } from './permissions'

export interface PermissionGroup {
  module: string
  items: ReadonlyArray<{ permission: Permission; label: string }>
}

/** Plain-language names for the permission table, grouped by module, for the Settings roles overview. */
export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  { module: 'Dashboard', items: [{ permission: 'dashboard.view', label: 'View the dashboard' }] },
  {
    module: 'Rooms',
    items: [
      { permission: 'rooms.view', label: 'View rooms' },
      { permission: 'rooms.status', label: 'Set a room to available, cleaning or maintenance' },
      { permission: 'rooms.manage', label: 'Add, edit and delete rooms' },
    ],
  },
  {
    module: 'Guests',
    items: [
      { permission: 'guests.view', label: 'View guests' },
      { permission: 'guests.manage', label: 'Register and edit guests' },
      { permission: 'guests.delete', label: 'Delete guests' },
    ],
  },
  {
    module: 'Reservations',
    items: [
      { permission: 'reservations.view', label: 'View reservations' },
      { permission: 'reservations.manage', label: 'Create, edit and cancel bookings' },
    ],
  },
  {
    module: 'Check-in / Check-out',
    items: [
      { permission: 'frontDesk.overview', label: 'See arrivals and in-house guests' },
      { permission: 'frontDesk.view', label: 'Open the front desk' },
      { permission: 'frontDesk.manage', label: 'Check guests in and out' },
    ],
  },
  {
    module: 'Billing & Payments',
    items: [
      { permission: 'billing.view', label: 'View invoices and payments' },
      { permission: 'billing.manage', label: 'Record payments and add charges' },
      { permission: 'billing.supervise', label: 'Give discounts, refund, remove adjustments' },
    ],
  },
  {
    module: 'Housekeeping',
    items: [
      { permission: 'housekeeping.view', label: 'View cleaning tasks' },
      { permission: 'housekeeping.manage', label: 'Create, update and complete tasks' },
    ],
  },
  {
    module: 'Restaurant',
    items: [
      { permission: 'restaurant.view', label: 'View the menu and orders' },
      { permission: 'restaurant.orders', label: 'Take and update orders' },
      { permission: 'restaurant.menu', label: 'Edit the menu' },
    ],
  },
  {
    module: 'Staff',
    items: [
      { permission: 'staff.view', label: 'View staff' },
      { permission: 'staff.manage', label: 'Add, edit and remove staff' },
    ],
  },
  {
    module: 'Inventory',
    items: [
      { permission: 'inventory.view', label: 'View stock' },
      { permission: 'inventory.stock', label: 'Receive and issue stock' },
      { permission: 'inventory.manage', label: 'Add, edit and delete items' },
    ],
  },
  { module: 'Reports', items: [{ permission: 'reports.view', label: 'View reports and export CSV' }] },
  {
    module: 'Settings',
    items: [
      { permission: 'settings.view', label: 'View settings' },
      { permission: 'settings.manage', label: 'Edit the hotel profile' },
    ],
  },
]
