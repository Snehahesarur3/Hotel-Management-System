import type { ServiceProvider } from '@/api/types'
import { basicAuthorization, type CurrentUser } from '@/auth/session'
import { ApiError } from '@/types/api'
import type { HealthStatus, PageResponse } from '@/types/api'
import type { DashboardSummary, OccupancySeries, ReservationSummary, RevenueSeries } from '@/types/dashboard'
import type { Payment, Room, StockMovement } from '@/types/domain'
import type { BillingSummary, Invoice, InvoiceSummary, PaymentRecord } from '@/types/billing'
import type { CheckInPreview, CheckOutResult, FrontDeskOverview, StayBill } from '@/types/frontDesk'
import type { GuestHistory, GuestSummary } from '@/types/guest'
import type { HousekeepingSummary, HousekeepingTaskView } from '@/types/housekeeping'
import type { InventoryItemView, InventorySummary, SupplierView } from '@/types/inventory'
import type { GuestReport, OccupancyReport, PaymentReport, ReservationReport, RevenueReport } from '@/types/reports'
import type { HotelSettings } from '@/types/settings'
import type { StaffSummary, StaffView } from '@/types/staff'
import type { MenuItemView, OrderView, RestaurantSummary } from '@/types/restaurant'
import type { AvailableRoom, ReservationDetails } from '@/types/reservation'
import type { RoomActivity } from '@/types/room'
import { httpClient } from './client'
import { toQueryParams } from './query'

const get = async <T>(url: string, params?: URLSearchParams) => (await httpClient.get<T>(url, { params })).data
const post = async <T>(url: string, body?: unknown) => (await httpClient.post<T>(url, body)).data
const put = async <T>(url: string, body: unknown) => (await httpClient.put<T>(url, body)).data
const patch = async <T>(url: string, body?: unknown) => (await httpClient.patch<T>(url, body)).data
const del = async (url: string) => {
  await httpClient.delete(url)
}
const enc = encodeURIComponent

const INVALID_CREDENTIALS_MESSAGE = 'Incorrect username or password'

/** Spring Boot REST implementation of the service contract. */
export const httpServices: ServiceProvider = {
  system: {
    health: () => get<HealthStatus>('/health'),
  },
  auth: {
    signIn: async (username, password) => {
      const authorization = basicAuthorization(username.trim(), password)
      try {
        const { data: user } = await httpClient.get<CurrentUser>('/auth/me', { headers: { Authorization: authorization } })
        return { user, authorization }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE)
        throw error
      }
    },
  },
  dashboard: {
    summary: () => get<DashboardSummary>('/dashboard/summary'),
    revenue: () => get<RevenueSeries>('/dashboard/revenue'),
    occupancy: () => get<OccupancySeries>('/dashboard/occupancy'),
  },
  rooms: {
    list: (query) => get<PageResponse<Room>>('/rooms', toQueryParams(query)),
    get: (id) => get<Room>(`/rooms/${enc(id)}`),
    floors: () => get<number[]>('/rooms/floors'),
    activity: (id) => get<RoomActivity>(`/rooms/${enc(id)}/activity`),
    create: (input) => post<Room>('/rooms', input),
    update: (id, input) => put<Room>(`/rooms/${enc(id)}`, input),
    updateStatus: (id, status) => patch<Room>(`/rooms/${enc(id)}/status`, { status }),
    remove: (id) => del(`/rooms/${enc(id)}`),
  },
  guests: {
    list: (query) => get<PageResponse<GuestSummary>>('/guests', toQueryParams(query)),
    get: (id) => get<GuestSummary>(`/guests/${enc(id)}`),
    nationalities: () => get<string[]>('/guests/nationalities'),
    history: (id) => get<GuestHistory>(`/guests/${enc(id)}/history`),
    create: (input) => post<GuestSummary>('/guests', input),
    update: (id, input) => put<GuestSummary>(`/guests/${enc(id)}`, input),
    remove: (id) => del(`/guests/${enc(id)}`),
  },
  reservations: {
    list: (query) => get<PageResponse<ReservationSummary>>('/reservations', toQueryParams(query)),
    get: (id) => get<ReservationDetails>(`/reservations/${enc(id)}`),
    availability: (query) => get<AvailableRoom[]>('/reservations/availability', toQueryParams(query)),
    create: (input) => post<ReservationSummary>('/reservations', input),
    update: (id, input) => put<ReservationSummary>(`/reservations/${enc(id)}`, input),
    cancel: (id) => post<ReservationSummary>(`/reservations/${enc(id)}/cancel`),
  },
  frontDesk: {
    overview: () => get<FrontDeskOverview>('/front-desk/overview'),
    checkInPreview: (id) => get<CheckInPreview>(`/front-desk/check-in/${enc(id)}`),
    checkIn: (id, input) => post<ReservationSummary>(`/front-desk/check-in/${enc(id)}`, input),
    checkOutPreview: (id) => get<StayBill>(`/front-desk/check-out/${enc(id)}`),
    checkOut: (id, input) => post<CheckOutResult>(`/front-desk/check-out/${enc(id)}`, input),
  },
  billing: {
    summary: () => get<BillingSummary>('/billing/summary'),
    invoices: (query) => get<PageResponse<InvoiceSummary>>('/billing/invoices', toQueryParams(query)),
    invoice: (id) => get<Invoice>(`/billing/invoices/${enc(id)}`),
    addAdjustment: (id, input) => post<Invoice>(`/billing/invoices/${enc(id)}/adjustments`, input),
    removeAdjustment: async (id, adjustmentId) =>
      (await httpClient.delete<Invoice>(`/billing/invoices/${enc(id)}/adjustments/${enc(adjustmentId)}`)).data,
    recordPayment: (id, input) => post<Payment>(`/billing/invoices/${enc(id)}/payments`, input),
    refund: (id, input) => post<Payment>(`/billing/invoices/${enc(id)}/refund`, input),
    payments: (query) => get<PageResponse<PaymentRecord>>('/payments', toQueryParams(query)),
    updatePaymentStatus: (id, status) => patch<Payment>(`/payments/${enc(id)}/status`, { status }),
  },
  housekeeping: {
    list: (query) => get<PageResponse<HousekeepingTaskView>>('/housekeeping/tasks', toQueryParams(query)),
    summary: (date) => get<HousekeepingSummary>('/housekeeping/summary', toQueryParams({ date })),
    create: (input) => post<HousekeepingTaskView>('/housekeeping/tasks', input),
    update: (id, input) => put<HousekeepingTaskView>(`/housekeeping/tasks/${enc(id)}`, input),
    updateStatus: (id, status) => patch<HousekeepingTaskView>(`/housekeeping/tasks/${enc(id)}/status`, { status }),
    remove: (id) => del(`/housekeeping/tasks/${enc(id)}`),
  },
  restaurant: {
    summary: () => get<RestaurantSummary>('/restaurant/summary'),
    menu: (query) => get<PageResponse<MenuItemView>>('/restaurant/menu', toQueryParams(query)),
    createMenuItem: (input) => post<MenuItemView>('/restaurant/menu', input),
    updateMenuItem: (id, input) => put<MenuItemView>(`/restaurant/menu/${enc(id)}`, input),
    setMenuItemAvailability: (id, available) => patch<MenuItemView>(`/restaurant/menu/${enc(id)}/availability`, { available }),
    removeMenuItem: (id) => del(`/restaurant/menu/${enc(id)}`),
    orders: (query) => get<PageResponse<OrderView>>('/restaurant/orders', toQueryParams(query)),
    createOrder: (input) => post<OrderView>('/restaurant/orders', input),
    updateOrderStatus: (id, status) => patch<OrderView>(`/restaurant/orders/${enc(id)}/status`, { status }),
  },
  staff: {
    list: (query) => get<PageResponse<StaffView>>('/staff', toQueryParams(query)),
    summary: () => get<StaffSummary>('/staff/summary'),
    get: (id) => get<StaffView>(`/staff/${enc(id)}`),
    create: (input) => post<StaffView>('/staff', input),
    update: (id, input) => put<StaffView>(`/staff/${enc(id)}`, input),
    remove: (id) => del(`/staff/${enc(id)}`),
  },
  inventory: {
    list: (query) => get<PageResponse<InventoryItemView>>('/inventory/items', toQueryParams(query)),
    summary: () => get<InventorySummary>('/inventory/summary'),
    suppliers: () => get<SupplierView[]>('/inventory/suppliers'),
    movements: (id) => get<StockMovement[]>(`/inventory/items/${enc(id)}/movements`),
    create: (input) => post<InventoryItemView>('/inventory/items', input),
    update: (id, input) => put<InventoryItemView>(`/inventory/items/${enc(id)}`, input),
    stockIn: (id, input) => post<InventoryItemView>(`/inventory/items/${enc(id)}/stock-in`, input),
    stockOut: (id, input) => post<InventoryItemView>(`/inventory/items/${enc(id)}/stock-out`, input),
    remove: (id) => del(`/inventory/items/${enc(id)}`),
  },
  reports: {
    revenue: (query) => get<RevenueReport>('/reports/revenue', toQueryParams(query)),
    occupancy: (range) => get<OccupancyReport>('/reports/occupancy', toQueryParams(range)),
    reservations: (range) => get<ReservationReport>('/reports/reservations', toQueryParams(range)),
    guests: (range) => get<GuestReport>('/reports/guests', toQueryParams(range)),
    payments: (range) => get<PaymentReport>('/reports/payments', toQueryParams(range)),
  },
  settings: {
    get: () => get<HotelSettings>('/settings'),
    update: (input) => put<HotelSettings>('/settings', input),
  },
}
