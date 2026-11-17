import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import type { MenuItemInput } from '@/types/restaurant'
import { todayISO } from '@/utils/date'
import { mockBillingService as billing } from './billing'
import { mockFrontDeskService as frontDesk } from './frontDesk'
import { mockRestaurantService as restaurant } from './restaurant'

const dish: MenuItemInput = { name: 'Prawn Balchão', category: 'MAIN_COURSE', price: 690, isVegetarian: false, available: true }

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('menu', () => {
  it('lists dishes by course, then name, with filters', async () => {
    const page = await restaurant.menu({ size: 50 })
    expect(page.totalElements).toBe(20)
    expect(page.content[0]!.name).toBe('Aloo Paratha with Curd')
    expect(page.content.at(-1)!.category).toBe('BEVERAGES')
    expect((await restaurant.menu({ vegetarian: false })).totalElements).toBe(6)
    expect((await restaurant.menu({ available: false })).content.map((m) => m.id)).toEqual(['MNU-0016'])
    expect((await restaurant.menu({ search: 'kulfi' })).content[0]).toMatchObject({ name: 'Mango Kulfi', timesOrdered: 0 })
  })

  it('creates, edits and toggles dishes; names are unique', async () => {
    const created = await restaurant.createMenuItem(dish)
    expect(created).toMatchObject({ id: 'MNU-0021', timesOrdered: 0 })
    await expect(restaurant.createMenuItem({ ...dish, name: 'paneer tikka' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { name: '“Paneer Tikka” is already on the menu' },
    })
    await expect(restaurant.createMenuItem({ ...dish, name: 'X', price: 5 })).rejects.toMatchObject({
      fieldErrors: { name: 'Enter the dish name', price: 'Minimum ₹10' },
    })
    expect((await restaurant.updateMenuItem('MNU-0021', { ...dish, price: 720 })).price).toBe(720)
    expect((await restaurant.setMenuItemAvailability('MNU-0016', true)).available).toBe(true)
  })

  it('deletes only dishes that were never ordered', async () => {
    await expect(restaurant.removeMenuItem('MNU-0009')).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/^Goan Fish Curry with Rice appears on \d+ orders? and cannot be deleted/),
    })
    const created = await restaurant.createMenuItem(dish)
    await restaurant.removeMenuItem(created.id)
    expect(getDatabase().menuItems).toHaveLength(20)
  })
})

describe('orders', () => {
  it('lists orders newest first with totals including food GST', async () => {
    const page = await restaurant.orders({ size: 50 })
    expect(page.totalElements).toBe(15)
    const times = page.content.map((o) => o.orderedAt)
    expect([...times].sort().reverse()).toEqual(times)
    expect((await restaurant.orders({ status: 'PLACED' })).content.map((o) => o.id).sort()).toEqual(['ORD-0014', 'ORD-0015'])
    const ord5 = page.content.find((o) => o.id === 'ORD-0005')!
    expect(ord5).toMatchObject({ subtotal: 1340, gst: 67, total: 1407, guestName: 'Arjun Reddy', roomNumber: '102' })
  })

  it('charges a new order to an in-house stay at today’s menu prices', async () => {
    const before = (await billing.invoice('BK-0013')).total
    const order = await restaurant.createOrder({
      reservationId: 'BK-0013',
      items: [
        { menuItemId: 'MNU-0005', quantity: 2 },
        { menuItemId: 'MNU-0018', quantity: 1 },
      ],
    })
    expect(order).toMatchObject({ id: 'ORD-0016', status: 'PLACED', roomNumber: '102', subtotal: 960, gst: 48, total: 1008, itemCount: 3 })
    expect(order.orderedAt.startsWith(todayISO())).toBe(true)
    expect((await billing.invoice('BK-0013')).total).toBe(before + 1008)

    // A later price change does not touch the order.
    await restaurant.updateMenuItem('MNU-0005', { name: 'Paneer Tikka', category: 'STARTERS', price: 500, isVegetarian: true, available: true })
    expect((await restaurant.orders({ search: 'ORD-0016' })).content[0]!.subtotal).toBe(960)
  })

  it('refuses unavailable dishes and guests who are not in-house', async () => {
    await expect(restaurant.createOrder({ reservationId: 'BK-0013', items: [{ menuItemId: 'MNU-0016', quantity: 1 }] })).rejects.toMatchObject({
      status: 409,
      message: 'Mango Kulfi is not available right now',
    })
    await expect(restaurant.createOrder({ reservationId: 'BK-0030', items: [{ menuItemId: 'MNU-0018', quantity: 1 }] })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { reservationId: 'BK-0030 is confirmed; orders can only be charged to in-house guests' },
    })
    await expect(restaurant.createOrder({ reservationId: 'BK-0013', items: [] })).rejects.toMatchObject({
      fieldErrors: { items: 'Add at least one dish' },
    })
  })

  it('moves orders through the kitchen and keeps cancelled orders off the bill', async () => {
    expect((await restaurant.updateOrderStatus('ORD-0015', 'PREPARING')).status).toBe('PREPARING')
    expect((await restaurant.updateOrderStatus('ORD-0015', 'DELIVERED')).status).toBe('DELIVERED')
    await expect(restaurant.updateOrderStatus('ORD-0015', 'CANCELLED')).rejects.toMatchObject({
      status: 409,
      message: 'ORD-0015 is delivered and cannot become cancelled',
    })

    const before = (await billing.invoice('BK-0023')).total
    await restaurant.updateOrderStatus('ORD-0014', 'CANCELLED') // 680 + 5% GST
    expect((await billing.invoice('BK-0023')).total).toBe(before - 714)
  })

  it('locks orders once the stay is checked out', async () => {
    await frontDesk.checkOut('BK-0014', { paymentMethod: 'CASH' }) // ORD-0015 still placed
    await expect(restaurant.updateOrderStatus('ORD-0015', 'CANCELLED')).rejects.toMatchObject({
      status: 409,
      message: 'ORD-0015 belongs to INV-0014, which is final; the order can no longer change',
    })
  })

  it('summarises the kitchen and today’s sales', async () => {
    const summary = await restaurant.summary()
    expect(summary).toMatchObject({ open: 4, placed: 2, preparing: 2, availableItems: 19, totalItems: 20 })
    expect(summary.ordersToday).toBeGreaterThan(0)
  })
})
