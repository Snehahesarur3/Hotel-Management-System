/**
 * LIVE API CHECK (opt-in): runs the frontend's HTTP adapter against a running backend.
 *
 *   cd backend && ./mvnw spring-boot:run          # fresh start = fresh seed
 *   cd frontend && HMS_LIVE_API=http://localhost:8080/api npm test -- src/api/http/live.test.ts
 *
 * It verifies, for every service method:
 *  1. access: each demo role is let through by the backend exactly when the frontend's permission table says so
 *     (writes use unknown ids or empty bodies, so permitted calls fail validation and nothing changes);
 *  2. shapes: as admin, every read returns the same JSON structure from the API as from the mock services.
 * Skipped unless HMS_LIVE_API is set, so the normal test run needs no backend.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ServiceProvider } from '@/api/types'
import { DEV_USERS } from '@/auth/devUsers'
import { hasPermission, type Permission } from '@/auth/permissions'
import { sessionStore } from '@/auth/session'
import { resetDatabase } from '@/mock/db'
import { mockServices } from '@/mock/services'
import { ACCESS_RULES } from '@/mock/services/accessControl'
import { ApiError } from '@/types/api'
import { addDays, todayISO } from '@/utils/date'
import { httpClient } from './client'
import { httpServices } from './index'

// Read from the shell environment (Node), not from Vite's VITE_ variables.
const LIVE = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.HMS_LIVE_API

type Module = keyof typeof ACCESS_RULES
interface Ids {
  room: string
  guest: string
  reservation: string
  inHouse: string
  staff: string
  item: string
}
type Call = { module: Module; method: string; args: (ids: Ids) => unknown[]; read: boolean }

const today = todayISO()
const range = { from: addDays(today, -30), to: today }
const NOPE = 'NOPE-0000'

/** Every service method with arguments: real ids for reads, unknown ids / empty bodies for writes. */
const CALLS: Call[] = [
  ...(['summary', 'revenue', 'occupancy'] as const).map((m) => r('dashboard', m)),
  r('rooms', 'list'), r('rooms', 'get', (i) => [i.room]), r('rooms', 'floors'), r('rooms', 'activity', (i) => [i.room]),
  w('rooms', 'create', () => [{}]), w('rooms', 'update', () => [NOPE, {}]), w('rooms', 'updateStatus', () => [NOPE, 'AVAILABLE']), w('rooms', 'remove', () => [NOPE]),
  r('guests', 'list'), r('guests', 'get', (i) => [i.guest]), r('guests', 'nationalities'), r('guests', 'history', (i) => [i.guest]),
  w('guests', 'create', () => [{}]), w('guests', 'update', () => [NOPE, {}]), w('guests', 'remove', () => [NOPE]),
  r('reservations', 'list'), r('reservations', 'get', (i) => [i.reservation]),
  r('reservations', 'availability', () => [{ checkIn: addDays(today, 20), checkOut: addDays(today, 22), guests: 2 }]),
  w('reservations', 'create', () => [{}]), w('reservations', 'update', () => [NOPE, {}]), w('reservations', 'cancel', () => [NOPE]),
  r('frontDesk', 'overview'), r('frontDesk', 'checkOutPreview', (i) => [i.inHouse]),
  w('frontDesk', 'checkInPreview', () => [NOPE]), w('frontDesk', 'checkIn', () => [NOPE, {}]), w('frontDesk', 'checkOut', () => [NOPE, {}]),
  r('billing', 'summary'), r('billing', 'invoices'), r('billing', 'invoice', (i) => [i.inHouse]), r('billing', 'payments'),
  w('billing', 'addAdjustment', () => [NOPE, { kind: 'EXTRA' }]), w('billing', 'addAdjustment', () => [NOPE, { kind: 'DISCOUNT' }]),
  w('billing', 'removeAdjustment', () => [NOPE, NOPE]), w('billing', 'recordPayment', () => [NOPE, {}]),
  w('billing', 'refund', () => [NOPE, {}]), w('billing', 'updatePaymentStatus', () => [NOPE, 'COMPLETED']),
  r('housekeeping', 'list'), r('housekeeping', 'summary'),
  w('housekeeping', 'create', () => [{}]), w('housekeeping', 'update', () => [NOPE, {}]), w('housekeeping', 'updateStatus', () => [NOPE, 'COMPLETED']), w('housekeeping', 'remove', () => [NOPE]),
  r('restaurant', 'summary'), r('restaurant', 'menu'), r('restaurant', 'orders'),
  w('restaurant', 'createMenuItem', () => [{}]), w('restaurant', 'updateMenuItem', () => [NOPE, {}]),
  w('restaurant', 'setMenuItemAvailability', () => [NOPE, true]), w('restaurant', 'removeMenuItem', () => [NOPE]),
  w('restaurant', 'createOrder', () => [{}]), w('restaurant', 'updateOrderStatus', () => [NOPE, 'SERVED']),
  r('staff', 'list'), r('staff', 'summary'), r('staff', 'get', (i) => [i.staff]),
  w('staff', 'create', () => [{}]), w('staff', 'update', () => [NOPE, {}]), w('staff', 'remove', () => [NOPE]),
  r('inventory', 'list'), r('inventory', 'summary'), r('inventory', 'suppliers'), r('inventory', 'movements', (i) => [i.item]),
  w('inventory', 'create', () => [{}]), w('inventory', 'update', () => [NOPE, {}]), w('inventory', 'stockIn', () => [NOPE, {}]),
  w('inventory', 'stockOut', () => [NOPE, {}]), w('inventory', 'remove', () => [NOPE]),
  r('reports', 'revenue', () => [{ ...range, groupBy: 'DAY' }]),
  ...(['occupancy', 'reservations', 'guests', 'payments'] as const).map((m) => r('reports', m, () => [range])),
  r('settings', 'get'), w('settings', 'update', () => [{}]),
]

function r(module: Module, method: string, args: (ids: Ids) => unknown[] = () => []): Call {
  return { module, method, args, read: true }
}
function w(module: Module, method: string, args: (ids: Ids) => unknown[]): Call {
  return { module, method, args, read: false }
}

function invoke(services: ServiceProvider, call: Call, ids: Ids): Promise<unknown> {
  const target = services[call.module] as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>
  return target[call.method]!(...call.args(ids))
}

function permissionFor(call: Call, ids: Ids): Permission {
  const rule = (ACCESS_RULES[call.module] as Record<string, Permission | ((...a: unknown[]) => Permission)>)[call.method]!
  return typeof rule === 'function' ? rule(...call.args(ids)) : rule
}

/** Status of a call: 200 when it succeeds, else the ApiError status. */
async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise
    return 200
  } catch (error) {
    if (error instanceof ApiError) return error.status
    throw error
  }
}

/** Paths where two JSON values differ in structure (keys, kinds); values themselves are not compared. */
function shapeDiff(a: unknown, b: unknown, path = '$'): string[] {
  if (a === null || b === null || a === undefined || b === undefined) return []
  const kind = (v: unknown) => (Array.isArray(v) ? 'array' : typeof v)
  if (kind(a) !== kind(b)) return [`${path}: ${kind(a)} vs ${kind(b)}`]
  if (Array.isArray(a) && Array.isArray(b)) return a.length && b.length ? shapeDiff(a[0], b[0], `${path}[0]`) : []
  if (typeof a === 'object') {
    const ao = a as Record<string, unknown>
    const bo = b as Record<string, unknown>
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)])
    return [...keys].flatMap((k) =>
      !(k in ao) ? [`${path}.${k}: only in API`] : !(k in bo) ? [`${path}.${k}: only in mock`] : shapeDiff(ao[k], bo[k], `${path}.${k}`),
    )
  }
  return []
}

/** One existing record per module. */
async function idsFrom(services: ServiceProvider): Promise<Ids> {
  const [rooms, guests, reservations, overview, staff, items] = await Promise.all([
    services.rooms.list({ size: 1 }),
    services.guests.list({ size: 1 }),
    services.reservations.list({ size: 1 }),
    services.frontDesk.overview(),
    services.staff.list({ size: 1 }),
    services.inventory.list({ size: 1 }),
  ])
  return {
    room: rooms.content[0]!.id,
    guest: guests.content[0]!.id,
    reservation: reservations.content[0]!.id,
    inHouse: overview.inHouse[0]!.id,
    staff: staff.content[0]!.id,
    item: items.content[0]!.id,
  }
}

const signInAs = async (username: string, password: string) => sessionStore.start(await httpServices.auth.signIn(username, password))

describe.skipIf(!LIVE)('live API', () => {
  const ids = {} as Ids
  const originalAdapter = httpClient.defaults.adapter
  const originalBase = httpClient.defaults.baseURL

  beforeAll(async () => {
    // Node's HTTP adapter: no browser CORS in the test environment.
    httpClient.defaults.adapter = 'http'
    httpClient.defaults.baseURL = LIVE
    await signInAs('admin', 'admin123')
    Object.assign(ids, await idsFrom(httpServices))
  })

  afterAll(() => {
    httpClient.defaults.adapter = originalAdapter
    httpClient.defaults.baseURL = originalBase
    sessionStore.end('signed-out')
  })

  it('rejects wrong credentials', async () => {
    await expect(httpServices.auth.signIn('admin', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Incorrect username or password' })
  })

  it('covers every guarded service method', () => {
    for (const [module, rules] of Object.entries(ACCESS_RULES)) {
      const called = new Set(CALLS.filter((c) => c.module === module).map((c) => c.method))
      expect([...called].sort(), module).toEqual(Object.keys(rules).sort())
    }
  })

  it.each(DEV_USERS.map((u) => [u.username, u] as const))('enforces the permission table for %s', async (_name, user) => {
    await signInAs(user.username, user.password)
    const mismatches: string[] = []
    for (const call of CALLS) {
      const allowed = hasPermission([user.role], permissionFor(call, ids))
      const status = await statusOf(invoke(httpServices, call, ids))
      if (status === 401 || status >= 500) mismatches.push(`${call.module}.${call.method}: unexpected ${status}`)
      else if (allowed === (status === 403)) mismatches.push(`${call.module}.${call.method}: frontend ${allowed ? 'allows' : 'denies'}, API answered ${status}`)
      else if (allowed && call.read && status !== 200) mismatches.push(`${call.module}.${call.method}: read failed with ${status}`)
    }
    expect(mismatches).toEqual([])
  })

  it('rejects invalid input with the same status, message and field errors as the mock services', async () => {
    await signInAs('admin', 'admin123')
    resetDatabase()
    // Seed ids (identical on both sides), taken from the mock so records created by other tests are never used.
    const overview = await mockServices.frontDesk.overview()
    const stay = overview.inHouse[0]!
    const item = (await mockServices.inventory.list({ size: 1 })).content[0]!
    const guest = await mockServices.guests.get('GST-0001')
    const staffId = (await mockServices.staff.list({ size: 1, department: 'HOUSEKEEPING' })).content[0]!.id
    const room = { floor: 1, type: 'DELUXE' as const, capacity: 2, pricePerNight: 5000, amenities: [] as string[], status: 'AVAILABLE' as const, description: '' }
    const booking = { guestId: guest.id, roomId: 'RM-101', numberOfGuests: 1, source: 'PHONE', status: 'CONFIRMED' } as const
    const bad = <T,>(value: unknown) => value as T

    const cases: Array<[string, (s: ServiceProvider) => Promise<unknown>]> = [
      ['room: empty form', (s) => s.rooms.create(bad({}))],
      ['room: bad values', (s) => s.rooms.create({ ...room, roomNumber: '12', capacity: 0, pricePerNight: 100.555 })],
      ['room: no type and number off its floor', (s) => s.rooms.create(bad({ ...room, type: undefined, roomNumber: '211' }))],
      ['room: duplicate number', (s) => s.rooms.create({ ...room, roomNumber: '101' })],
      ['room: number off its floor', (s) => s.rooms.create({ ...room, roomNumber: '211' })],
      ['room: new room occupied', (s) => s.rooms.create({ ...room, roomNumber: '112', status: 'OCCUPIED' })],
      ['room status: guest in-house', (s) => s.rooms.updateStatus(stay.roomId, 'MAINTENANCE')],
      ['room status: occupied by hand', (s) => s.rooms.updateStatus('RM-101', 'OCCUPIED')],
      ['guest: empty form', (s) => s.guests.create(bad({}))],
      ['guest: bad values', (s) => s.guests.create({ fullName: 'N', email: 'not-an-email', phone: '123', address: '', nationality: '', idProofType: 'VOTER_ID', idProofNumber: 'AB1' })],
      ['guest: duplicate email', (s) => s.guests.create({ fullName: 'Someone Else', email: guest.email.toUpperCase(), phone: '+91 90000 11111', address: '2 Road, Goa', nationality: 'Indian', idProofType: 'PASSPORT', idProofNumber: 'K7654321' })],
      ['guest: bad name and bad ID format', (s) => s.guests.create({ fullName: 'N', email: 'neha.k@example.com', phone: '+91 90000 11111', address: '2 Road, Goa', nationality: 'Indian', idProofType: 'VOTER_ID', idProofNumber: 'AB1' })],
      ['guest: not found', (s) => s.guests.get('GST-9999')],
      ['booking: empty form', (s) => s.reservations.create(bad({}))],
      ['booking: dates reversed', (s) => s.reservations.create({ ...booking, checkIn: addDays(today, 5), checkOut: addDays(today, 3) })],
      ['booking: no guest and dates reversed', (s) => s.reservations.create({ ...booking, guestId: '', checkIn: addDays(today, 5), checkOut: addDays(today, 3) })],
      ['booking: in the past', (s) => s.reservations.create({ ...booking, checkIn: addDays(today, -3), checkOut: addDays(today, -1) })],
      ['booking: too many guests', (s) => s.reservations.create({ ...booking, numberOfGuests: 20, checkIn: addDays(today, 30), checkOut: addDays(today, 31) })],
      ['booking: room taken', (s) => s.reservations.create({ ...booking, roomId: stay.roomId, checkIn: today, checkOut: addDays(today, 1) })],
      ['booking: cancel a checked-in stay', (s) => s.reservations.cancel(stay.id)],
      ['check-in: guest already in-house', (s) => s.frontDesk.checkInPreview(stay.id)],
      ['payment: negative amount', (s) => s.billing.recordPayment(stay.id, { amount: -5, method: 'CASH' })],
      ['discount: over 100%', (s) => s.billing.addAdjustment(stay.id, { kind: 'DISCOUNT', description: 'Too generous', percent: 150 })],
      ['extra charge: no description or amount', (s) => s.billing.addAdjustment(stay.id, { kind: 'EXTRA', description: '', amount: 0, gstPercent: 18 })],
      ['discount: no description, amount and percentage', (s) => s.billing.addAdjustment(stay.id, { kind: 'DISCOUNT', description: '', amount: 100, percent: 10 })],
      ['refund: no credit', (s) => s.billing.refund(stay.id, { method: 'CASH' })],
      ['task: empty form', (s) => s.housekeeping.create(bad({}))],
      ['task: in the past', (s) => s.housekeeping.create({ roomId: 'RM-101', assignedStaffId: staffId, taskType: 'DEEP_CLEAN', priority: 'NORMAL', scheduledDate: addDays(today, -5) })],
      ['task: no staff and in the past', (s) => s.housekeeping.create({ roomId: 'RM-101', assignedStaffId: '', taskType: 'DEEP_CLEAN', priority: 'NORMAL', scheduledDate: addDays(today, -5) })],
      ['menu item: empty form', (s) => s.restaurant.createMenuItem(bad({}))],
      ['order: empty form', (s) => s.restaurant.createOrder(bad({}))],
      ['order: unknown stay', (s) => s.restaurant.createOrder({ reservationId: 'BK-9999', items: [{ menuItemId: 'MNU-0001', quantity: 1 }] })],
      ['staff: empty form', (s) => s.staff.create(bad({}))],
      ['inventory item: empty form', (s) => s.inventory.create(bad({}))],
      ['stock out: more than on hand', (s) => s.inventory.stockOut(item.id, { quantity: item.quantity + 1000, reason: 'Used in rooms' })],
      ['settings: empty form', (s) => s.settings.update(bad({}))],
      ['settings: check-out after check-in', (s) => s.settings.update({ name: 'Aurelia Bay Hotel', address: '14 Marine Crescent, Goa', phone: '+91 832 000 0100', email: 'frontdesk@aureliabay.example', gstin: '30ABCDE1234F1Z5', checkInTime: '11:00', checkOutTime: '12:00' })],
      ['settings: bad GSTIN and time', (s) => s.settings.update({ name: 'A', address: '14 Marine Crescent, Goa', phone: '+91 832 000 0100', email: 'frontdesk@aureliabay.example', gstin: 'GST-1', checkInTime: '25:00', checkOutTime: '11:00' })],
      ['stock out: no reason', (s) => s.inventory.stockOut(item.id, { quantity: 1, reason: '' })],
    ]

    const outcome = async (call: Promise<unknown>) => {
      try {
        await call
        return 'succeeded'
      } catch (error) {
        const e = error as ApiError
        return { status: e.status, message: e.message, fieldErrors: Object.fromEntries(Object.entries(e.fieldErrors ?? {}).sort()) }
      }
    }
    const mismatches: string[] = []
    for (const [name, call] of cases) {
      const [fromApi, fromMock] = [await outcome(call(httpServices)), await outcome(call(mockServices))]
      if (fromApi === 'succeeded' || fromMock === 'succeeded') mismatches.push(`${name}: API ${JSON.stringify(fromApi)}, mock ${JSON.stringify(fromMock)}`)
      else if (JSON.stringify(fromApi) !== JSON.stringify(fromMock)) mismatches.push(`${name}:\n  API  ${JSON.stringify(fromApi)}\n  mock ${JSON.stringify(fromMock)}`)
    }
    expect(mismatches.join('\n')).toBe('')
  })

  it('round-trips writes as reception, with manager-only steps refused', async () => {
    await signInAs('reception', 'reception123')
    const stamp = Date.now()
    const guest = await httpServices.guests.create({
      fullName: 'Live Check Guest',
      email: `live.check.${stamp}@example.com`,
      phone: '+91 90000 12345',
      address: '1 Test Street, Pune',
      nationality: 'Indian',
      idProofType: 'PASSPORT',
      idProofNumber: 'K1234567',
    })
    expect(guest.idProofNumber).not.toContain('1234567') // stored masked
    const updated = await httpServices.guests.update(guest.id, {
      fullName: 'Live Check Guest',
      email: guest.email,
      phone: '+91 90000 54321',
      address: guest.address,
      nationality: guest.nationality,
      idProofType: guest.idProofType,
    })
    expect(updated.phone).toBe('+91 90000 54321')

    const checkIn = addDays(today, 40)
    const checkOut = addDays(today, 42)
    const [room] = await httpServices.reservations.availability({ checkIn, checkOut, guests: 1 })
    const booking = await httpServices.reservations.create({
      guestId: guest.id,
      roomId: room!.room.id,
      checkIn,
      checkOut,
      numberOfGuests: 1,
      source: 'PHONE',
      status: 'CONFIRMED',
    })
    expect(booking).toMatchObject({ guestId: guest.id, status: 'CONFIRMED', nights: 2 })
    expect((await httpServices.reservations.cancel(booking.id)).status).toBe('CANCELLED')

    // Reception may not delete guests; a manager may not delete one with booking history (a business rule, 409).
    expect(await statusOf(httpServices.guests.remove(guest.id))).toBe(403)
    await signInAs('manager', 'manager123')
    expect(await statusOf(httpServices.guests.remove(guest.id))).toBe(409)
  })

  it('returns the same JSON structure as the mock services', async () => {
    await signInAs('admin', 'admin123')
    resetDatabase()
    // Seed records exist on both sides, even when earlier runs added records to the backend.
    const seedIds = await idsFrom(mockServices)
    const diffs: string[] = []
    for (const call of CALLS.filter((c) => c.read)) {
      const [fromApi, fromMock] = await Promise.all([invoke(httpServices, call, seedIds), invoke(mockServices, call, seedIds)])
      diffs.push(...shapeDiff(fromApi, fromMock).map((d) => `${call.module}.${call.method} ${d}`))
    }
    expect(diffs).toEqual([])
  })
})
