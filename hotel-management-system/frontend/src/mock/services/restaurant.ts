import type { RestaurantService } from '@/api/types'
import { orderAmount } from '@/mock/calculations/billing'
import { applyListQuery, nextId } from '@/mock/collection'
import { getDatabase, mutateDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { menuItemSchema, orderInputSchema } from '@/schemas/restaurant'
import { ApiError } from '@/types/api'
import { invoiceNumberFor } from '@/types/billing'
import type { MenuItem, RestaurantOrder } from '@/types/domain'
import { MENU_CATEGORIES, ORDER_STATUSES, type OrderStatus } from '@/types/enums'
import {
  ORDER_TRANSITIONS,
  type MenuItemInput,
  type MenuItemView,
  type MenuListQuery,
  type OrderInput,
  type OrderListQuery,
  type OrderView,
  type RestaurantSummary,
} from '@/types/restaurant'
import { nowISODateTime, todayISO } from '@/utils/date'
import { enumLabel } from '@/utils/format'
import { percentOf, roundMoney, sumMoney } from '@/utils/money'

/**
 * Mock implementation of /api/restaurant.
 * Menu
 * - names are unique (ignoring case); items that have been ordered cannot be deleted (mark them unavailable instead).
 * Orders
 * - are charged to an in-house (checked-in) stay and appear on its invoice with 5% food GST;
 * - only available dishes can be ordered, at the menu price at that moment (later price changes don't affect the order);
 * - status flow: placed -> preparing -> served / delivered; placed or preparing orders can be cancelled;
 * - once the stay is checked out its invoice is final, so its orders are locked.
 */

const byMenuOrder = (a: MenuItem, b: MenuItem) =>
  MENU_CATEGORIES.indexOf(a.category) - MENU_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name)

function findItem(db: MockDatabase, id: string): MenuItem {
  const item = db.menuItems.find((m) => m.id === id)
  if (!item) throw new ApiError(404, `Menu item with id '${id}' was not found`)
  return item
}

function findOrder(db: MockDatabase, id: string): RestaurantOrder {
  const order = db.restaurantOrders.find((o) => o.id === id)
  if (!order) throw new ApiError(404, `Order with id '${id}' was not found`)
  return order
}

function timesOrdered(db: MockDatabase, itemId: string) {
  return db.restaurantOrders.filter((o) => o.status !== 'CANCELLED' && o.items.some((l) => l.menuItemId === itemId)).length
}

function toOrderView(db: MockDatabase, order: RestaurantOrder): OrderView {
  const reservation = db.reservations.find((r) => r.id === order.reservationId)
  const guest = reservation && db.guests.find((g) => g.id === reservation.guestId)
  const room = db.rooms.find((r) => r.id === order.roomId)
  const names = new Map(db.menuItems.map((m) => [m.id, m.name]))
  const subtotal = orderAmount(order)
  const gstPercent = db.settings.taxes.foodGstPercent
  const gst = percentOf(subtotal, gstPercent)
  return {
    id: order.id,
    reservationId: order.reservationId,
    roomId: order.roomId,
    roomNumber: room?.roomNumber ?? '—',
    guestName: guest?.fullName ?? 'Unknown guest',
    items: order.items.map((l) => ({
      menuItemId: l.menuItemId,
      name: names.get(l.menuItemId) ?? 'Removed item',
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: roundMoney(l.quantity * l.unitPrice),
    })),
    itemCount: order.items.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    gstPercent,
    gst,
    total: roundMoney(subtotal + gst),
    status: order.status,
    orderedAt: order.orderedAt,
    locked: reservation?.status !== 'CHECKED_IN',
  }
}

// ------------------------------------------------------------------ menu

function menu(query: MenuListQuery = {}) {
  const db = getDatabase()
  const { category, vegetarian, available } = query
  return applyListQuery(
    db.menuItems.map((m): MenuItemView => ({ ...m, timesOrdered: timesOrdered(db, m.id) })),
    query,
    {
      searchFields: (m) => [m.name, m.id, enumLabel(m.category)],
      filter: (m) =>
        (!category || m.category === category) &&
        (vegetarian === undefined || m.isVegetarian === vegetarian) &&
        (available === undefined || m.available === available),
      sortAccessors: { category: (m) => MENU_CATEGORIES.indexOf(m.category) },
      defaultSort: byMenuOrder,
    },
  )
}

function assertNameAvailable(db: MockDatabase, name: string, exceptId?: string) {
  const clash = db.menuItems.find((m) => m.name.toLowerCase() === name.toLowerCase() && m.id !== exceptId)
  if (clash) {
    const message = `“${clash.name}” is already on the menu`
    throw new ApiError(409, message, { name: message })
  }
}

function createItem(raw: MenuItemInput): MenuItemView {
  const db = getDatabase()
  const input = parseOrThrow(menuItemSchema, raw)
  assertNameAvailable(db, input.name)
  return mutateDatabase((draft) => {
    const item: MenuItem = { ...input, id: nextId(draft.menuItems.map((m) => m.id), 'MNU') }
    draft.menuItems.push(item)
    return { ...item, timesOrdered: 0 }
  })
}

function updateItem(id: string, raw: MenuItemInput): MenuItemView {
  const db = getDatabase()
  findItem(db, id)
  const input = parseOrThrow(menuItemSchema, raw)
  assertNameAvailable(db, input.name, id)
  return mutateDatabase((draft) => {
    const index = draft.menuItems.findIndex((m) => m.id === id)
    const item: MenuItem = { ...input, id }
    draft.menuItems[index] = item
    return { ...item, timesOrdered: timesOrdered(draft, id) }
  })
}

function setAvailability(id: string, available: boolean): MenuItemView {
  const db = getDatabase()
  findItem(db, id)
  return mutateDatabase((draft) => {
    const item = draft.menuItems.find((m) => m.id === id)!
    item.available = available
    return { ...item, timesOrdered: timesOrdered(draft, id) }
  })
}

function removeItem(id: string): void {
  const db = getDatabase()
  const item = findItem(db, id)
  const orders = db.restaurantOrders.filter((o) => o.items.some((l) => l.menuItemId === id)).length
  if (orders > 0) {
    throw new ApiError(
      409,
      `${item.name} appears on ${orders} order${orders === 1 ? '' : 's'} and cannot be deleted. Mark it unavailable to take it off the menu.`,
    )
  }
  mutateDatabase((draft) => {
    draft.menuItems = draft.menuItems.filter((m) => m.id !== id)
  })
}

// ------------------------------------------------------------------ orders

function orders(query: OrderListQuery = {}) {
  const db = getDatabase()
  const { status, date } = query
  return applyListQuery(
    db.restaurantOrders.map((o) => toOrderView(db, o)),
    query,
    {
      searchFields: (o) => [o.id, o.reservationId, o.guestName, o.roomNumber, ...o.items.map((i) => i.name)],
      filter: (o) => (!status || o.status === status) && (!date || o.orderedAt.startsWith(date)),
      sortAccessors: { status: (o) => ORDER_STATUSES.indexOf(o.status), roomNumber: (o) => Number(o.roomNumber) },
      defaultSort: (a, b) => b.orderedAt.localeCompare(a.orderedAt) || b.id.localeCompare(a.id),
    },
  )
}

function createOrder(raw: OrderInput): OrderView {
  const db = getDatabase()
  const input = parseOrThrow(orderInputSchema, raw)
  const reservation = db.reservations.find((r) => r.id === input.reservationId)
  if (!reservation) throw new ApiError(400, 'Validation failed', { reservationId: 'Choose an existing booking' })
  if (reservation.status !== 'CHECKED_IN') {
    const message = `${reservation.id} is ${enumLabel(reservation.status).toLowerCase()}; orders can only be charged to in-house guests`
    throw new ApiError(409, message, { reservationId: message })
  }
  const lines = input.items.map((line) => {
    const item = db.menuItems.find((m) => m.id === line.menuItemId)
    if (!item) throw new ApiError(400, 'Validation failed', { items: `Dish '${line.menuItemId}' is not on the menu` })
    if (!item.available) throw new ApiError(409, `${item.name} is not available right now`, { items: `${item.name} is not available right now` })
    return { menuItemId: item.id, quantity: line.quantity, unitPrice: item.price }
  })
  return mutateDatabase((draft) => {
    const order: RestaurantOrder = {
      id: nextId(draft.restaurantOrders.map((o) => o.id), 'ORD'),
      reservationId: reservation.id,
      roomId: reservation.roomId,
      items: lines,
      status: 'PLACED',
      orderedAt: nowISODateTime(),
    }
    draft.restaurantOrders.push(order)
    return toOrderView(draft, order)
  })
}

function updateOrderStatus(id: string, status: OrderStatus): OrderView {
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError(400, 'Validation failed', { status: 'Unknown order status' })
  }
  const db = getDatabase()
  const order = findOrder(db, id)
  const view = toOrderView(db, order)
  if (view.locked && ORDER_TRANSITIONS[order.status].length > 0) {
    throw new ApiError(409, `${id} belongs to ${invoiceNumberFor(order.reservationId)}, which is final; the order can no longer change`)
  }
  if (!ORDER_TRANSITIONS[order.status].includes(status)) {
    throw new ApiError(409, `${id} is ${enumLabel(order.status).toLowerCase()} and cannot become ${enumLabel(status).toLowerCase()}`)
  }
  return mutateDatabase((draft) => {
    const target = draft.restaurantOrders.find((o) => o.id === id)!
    target.status = status
    return toOrderView(draft, target)
  })
}

function summary(): RestaurantSummary {
  const db = getDatabase()
  const today = todayISO()
  const todays = db.restaurantOrders.filter((o) => o.orderedAt.startsWith(today) && o.status !== 'CANCELLED')
  const count = (s: OrderStatus) => db.restaurantOrders.filter((o) => o.status === s).length
  return {
    date: today,
    open: count('PLACED') + count('PREPARING'),
    placed: count('PLACED'),
    preparing: count('PREPARING'),
    ordersToday: todays.length,
    salesToday: sumMoney(todays.map(orderAmount)),
    availableItems: db.menuItems.filter((m) => m.available).length,
    totalItems: db.menuItems.length,
  }
}

export const mockRestaurantService: RestaurantService = {
  summary: () => mockCall(summary),
  menu: (query) => mockCall(() => menu(query)),
  createMenuItem: (input) => mockCall(() => createItem(input)),
  updateMenuItem: (id, input) => mockCall(() => updateItem(id, input)),
  setMenuItemAvailability: (id, available) => mockCall(() => setAvailability(id, available)),
  removeMenuItem: (id) => mockCall(() => removeItem(id)),
  orders: (query) => mockCall(() => orders(query)),
  createOrder: (input) => mockCall(() => createOrder(input)),
  updateOrderStatus: (id, status) => mockCall(() => updateOrderStatus(id, status)),
}
