import type { ListQuery } from './api'
import type { ISODate, ISODateTime, MenuItem } from './domain'
import type { MenuCategory, OrderStatus } from './enums'

/** Body of POST /api/restaurant/menu and PUT /api/restaurant/menu/{id}. */
export type MenuItemInput = Omit<MenuItem, 'id'>

export interface MenuItemView extends MenuItem {
  /** Times ordered (non-cancelled orders); items with orders cannot be deleted. */
  timesOrdered: number
}

export type MenuSortField = 'name' | 'category' | 'price' | 'timesOrdered'

/** GET /api/restaurant/menu?search=&category=&vegetarian=&available=&page=&size=&sort= */
export type MenuListQuery = ListQuery<MenuSortField> & {
  category?: MenuCategory
  vegetarian?: boolean
  available?: boolean
}

export interface OrderLineView {
  menuItemId: string
  name: string
  quantity: number
  /** Price locked in when the order was placed. */
  unitPrice: number
  amount: number
}

/** Order as returned by GET /api/restaurant/orders. */
export interface OrderView {
  id: string
  reservationId: string
  roomId: string
  roomNumber: string
  guestName: string
  items: OrderLineView[]
  itemCount: number
  subtotal: number
  gstPercent: number
  gst: number
  total: number
  status: OrderStatus
  orderedAt: ISODateTime
  /** The stay is checked out, so its invoice is final and the order can no longer change. */
  locked: boolean
}

export type OrderSortField = 'orderedAt' | 'total' | 'status' | 'roomNumber'

/** GET /api/restaurant/orders?search=&status=&date=&page=&size=&sort= */
export type OrderListQuery = ListQuery<OrderSortField> & { status?: OrderStatus; date?: ISODate }

/** POST /api/restaurant/orders: room service or restaurant bill charged to an in-house stay. */
export interface OrderInput {
  reservationId: string
  items: Array<{ menuItemId: string; quantity: number }>
}

/** GET /api/restaurant/summary */
export interface RestaurantSummary {
  date: ISODate
  /** Orders still to be served (placed or preparing). */
  open: number
  placed: number
  preparing: number
  /** Non-cancelled orders placed today and their value before GST. */
  ordersToday: number
  salesToday: number
  availableItems: number
  totalItems: number
}

/**
 * Order status flow: placed -> preparing -> served (in the restaurant) or delivered (room service).
 * Placed and preparing orders can be cancelled; served, delivered and cancelled orders are final.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SERVED', 'DELIVERED', 'CANCELLED'],
  SERVED: [],
  DELIVERED: [],
  CANCELLED: [],
}
