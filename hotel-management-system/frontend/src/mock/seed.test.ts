import { describe, expect, it } from 'vitest'
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  DEPARTMENTS,
  EMPLOYMENT_STATUSES,
  HOUSEKEEPING_STATUSES,
  HOUSEKEEPING_TASK_TYPES,
  ID_PROOF_TYPES,
  INVENTORY_CATEGORIES,
  MENU_CATEGORIES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  ROOM_STATUSES,
  ROOM_TYPES,
  TASK_PRIORITIES,
} from '@/types/enums'
import { buildDatabaseFromSeed } from './seed'

/**
 * Guards the canonical dataset in shared/seed. These checks are what make the
 * typed casts in seed.ts safe, and they enforce the data-consistency requirements.
 */
const TODAY = '2026-11-11'
const db = buildDatabaseFromSeed(TODAY)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

describe('seed dataset', () => {
  it('has the required volume of records', () => {
    expect(db.rooms).toHaveLength(50)
    expect(db.guests).toHaveLength(30)
    expect(db.reservations).toHaveLength(40)
    expect(db.payments).toHaveLength(25)
    expect(db.staff).toHaveLength(15)
    expect(db.menuItems).toHaveLength(20)
    expect(db.restaurantOrders).toHaveLength(15)
    expect(db.inventory).toHaveLength(30)
    expect(db.housekeepingTasks).toHaveLength(20)
  })

  it('uses only valid enum values', () => {
    const within = <T,>(values: readonly T[], allowed: readonly T[]) => values.every((v) => allowed.includes(v))
    expect(within(db.rooms.map((r) => r.type), ROOM_TYPES)).toBe(true)
    expect(within(db.rooms.map((r) => r.status), ROOM_STATUSES)).toBe(true)
    expect(within(db.reservations.map((r) => r.status), BOOKING_STATUSES)).toBe(true)
    expect(within(db.reservations.map((r) => r.source), BOOKING_SOURCES)).toBe(true)
    expect(within(db.payments.map((p) => p.method), PAYMENT_METHODS)).toBe(true)
    expect(within(db.payments.map((p) => p.status), PAYMENT_STATUSES)).toBe(true)
    expect(within(db.guests.map((g) => g.idProofType), ID_PROOF_TYPES)).toBe(true)
    expect(within(db.staff.map((s) => s.department), DEPARTMENTS)).toBe(true)
    expect(within(db.staff.map((s) => s.employmentStatus), EMPLOYMENT_STATUSES)).toBe(true)
    expect(within(db.menuItems.map((m) => m.category), MENU_CATEGORIES)).toBe(true)
    expect(within(db.restaurantOrders.map((o) => o.status), ORDER_STATUSES)).toBe(true)
    expect(within(db.inventory.map((i) => i.category), INVENTORY_CATEGORIES)).toBe(true)
    expect(within(db.housekeepingTasks.map((t) => t.status), HOUSEKEEPING_STATUSES)).toBe(true)
    expect(within(db.housekeepingTasks.map((t) => t.taskType), HOUSEKEEPING_TASK_TYPES)).toBe(true)
    expect(within(db.housekeepingTasks.map((t) => t.priority), TASK_PRIORITIES)).toBe(true)
  })

  it('resolves every date token to a real date', () => {
    for (const r of db.reservations) {
      expect(r.checkIn).toMatch(ISO_DATE)
      expect(r.checkOut).toMatch(ISO_DATE)
      expect(r.createdAt).toMatch(ISO_DATE_TIME)
    }
    for (const p of db.payments) expect(p.paymentDate).toMatch(ISO_DATE_TIME)
    expect(db.reservations.some((r) => r.checkIn === TODAY)).toBe(true)
  })

  it('has unique ids and resolvable references', () => {
    const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id))
    const roomIds = ids(db.rooms)
    const guestIds = ids(db.guests)
    const reservationIds = ids(db.reservations)
    const staffIds = ids(db.staff)
    const menuIds = ids(db.menuItems)
    expect(roomIds.size).toBe(db.rooms.length)
    expect(reservationIds.size).toBe(db.reservations.length)

    for (const r of db.reservations) {
      expect(guestIds.has(r.guestId)).toBe(true)
      expect(roomIds.has(r.roomId)).toBe(true)
    }
    for (const p of db.payments) expect(reservationIds.has(p.reservationId)).toBe(true)
    for (const o of db.restaurantOrders) {
      expect(reservationIds.has(o.reservationId)).toBe(true)
      expect(o.items.every((line) => menuIds.has(line.menuItemId))).toBe(true)
    }
    for (const t of db.housekeepingTasks) {
      expect(roomIds.has(t.roomId)).toBe(true)
      expect(staffIds.has(t.assignedStaffId)).toBe(true)
    }
  })

  it('never double-books a room and respects capacity', () => {
    const live = db.reservations.filter((r) => r.status !== 'CANCELLED')
    for (const a of live) {
      const room = db.rooms.find((x) => x.id === a.roomId)!
      expect(a.numberOfGuests).toBeLessThanOrEqual(room.capacity)
      expect(a.checkOut > a.checkIn).toBe(true)
      const overlapping = live.filter(
        (b) => b.id !== a.id && b.roomId === a.roomId && a.checkIn < b.checkOut && b.checkIn < a.checkOut,
      )
      expect(overlapping, `${a.id} overlaps`).toEqual([])
    }
  })

  it('keeps room statuses consistent with reservations and housekeeping', () => {
    for (const room of db.rooms) {
      const stays = db.reservations.filter((r) => r.roomId === room.id)
      const inHouse = stays.some((r) => r.status === 'CHECKED_IN')
      expect(room.status === 'OCCUPIED', `room ${room.roomNumber}`).toBe(inHouse)
      if (room.status === 'RESERVED') {
        expect(stays.some((r) => r.checkIn === TODAY && (r.status === 'CONFIRMED' || r.status === 'PENDING'))).toBe(true)
      }
      if (room.status === 'CLEANING') {
        expect(
          db.housekeepingTasks.some((t) => t.roomId === room.id && t.taskType === 'CHECKOUT_CLEAN' && t.status !== 'COMPLETED'),
        ).toBe(true)
      }
    }
  })

  it('keeps guest identity data masked and fictional', () => {
    for (const g of db.guests) {
      expect(g.idProofNumber).toMatch(/^X/)
      expect(g.email).toMatch(/@example\.com$/)
    }
  })
})
