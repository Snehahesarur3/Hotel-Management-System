import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, permissionForPath } from '@/routes/navigation'
import { USER_ROLES, type UserRole } from '@/types/enums'
import { DEV_USERS } from './devUsers'
import { PERMISSION_GROUPS } from './permissionLabels'
import { safeNextPath } from './nextPath'
import { hasPermission, PERMISSIONS, ROLE_LABELS } from './permissions'
import { basicAuthorization } from './session'

const modulesFor = (role: UserRole) => NAV_ITEMS.filter((item) => hasPermission([role], item.permission)).map((item) => item.label)

describe('permissions', () => {
  it('gives each role the modules of the backend access matrix', () => {
    expect(modulesFor('ADMIN')).toHaveLength(12)
    expect(modulesFor('MANAGER')).toHaveLength(12)
    expect(modulesFor('RECEPTIONIST')).toEqual([
      'Dashboard',
      'Rooms',
      'Reservations',
      'Guests',
      'Check-in / Check-out',
      'Housekeeping',
      'Restaurant',
      'Billing & Payments',
    ])
    expect(modulesFor('HOUSEKEEPING')).toEqual(['Dashboard', 'Rooms', 'Housekeeping', 'Inventory'])
    expect(modulesFor('RESTAURANT')).toEqual(['Dashboard', 'Rooms', 'Restaurant', 'Inventory'])
  })

  it('keeps discounts, refunds, guest deletion and reports for management', () => {
    for (const permission of ['billing.supervise', 'guests.delete', 'reports.view', 'staff.manage'] as const) {
      expect(PERMISSIONS[permission]).toEqual(['ADMIN', 'MANAGER'])
    }
    expect(hasPermission(['RECEPTIONIST'], 'billing.manage')).toBe(true)
    expect(hasPermission(['RECEPTIONIST'], 'billing.supervise')).toBe(false)
  })

  it('combines several roles and denies a user without roles', () => {
    expect(hasPermission(['HOUSEKEEPING', 'RESTAURANT'], 'restaurant.menu')).toBe(true)
    expect(hasPermission([], 'dashboard.view')).toBe(false)
    expect(hasPermission(undefined, 'dashboard.view')).toBe(false)
  })

  it('has one demo account and a label per role', () => {
    expect(DEV_USERS.map((u) => u.role).sort()).toEqual([...USER_ROLES].sort())
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...USER_ROLES].sort())
  })
})

describe('sign-in helpers', () => {
  it('builds UTF-8 safe HTTP Basic credentials', () => {
    expect(basicAuthorization('admin', 'admin123')).toBe('Basic YWRtaW46YWRtaW4xMjM=')
    expect(basicAuthorization('josé', 'pässword')).toBe('Basic am9zw6k6cMOkc3N3b3Jk')
  })

  it('only returns to in-app paths after sign-in', () => {
    expect(safeNextPath('/billing?tab=payments')).toBe('/billing?tab=payments')
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath('https://example.com')).toBe('/')
    expect(safeNextPath('//example.com/path')).toBe('/')
    expect(safeNextPath('/sign-in?next=/rooms')).toBe('/')
  })
})

describe('permissionForPath', () => {
  it('maps in-app paths to the module permission', () => {
    expect(permissionForPath('/')).toBe('dashboard.view')
    expect(permissionForPath('/billing/invoices/BK-0001?tab=x')).toBe('billing.view')
    expect(permissionForPath('/reservations/BK-0001')).toBe('reservations.view')
    expect(permissionForPath('/roomsx')).toBeUndefined()
  })
})

describe('permission labels', () => {
  it('names every permission exactly once in the roles overview', () => {
    const listed = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.permission))
    expect([...listed].sort()).toEqual(Object.keys(PERMISSIONS).sort())
  })
})
