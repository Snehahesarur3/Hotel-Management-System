import type { Session } from '@/auth/session'
import type { HealthStatus, PageResponse } from '@/types/api'
import type { DashboardSummary, OccupancySeries, RevenueSeries } from '@/types/dashboard'
import type { Payment, Room, StockMovement } from '@/types/domain'
import type { HousekeepingStatus, OrderStatus, PaymentStatus, RoomStatus } from '@/types/enums'
import type { HousekeepingListQuery, HousekeepingSummary, HousekeepingTaskInput, HousekeepingTaskView } from '@/types/housekeeping'
import type {
  MenuItemInput,
  MenuItemView,
  MenuListQuery,
  OrderInput,
  OrderListQuery,
  OrderView,
  RestaurantSummary,
} from '@/types/restaurant'
import type {
  InventoryItemInput,
  InventoryItemView,
  InventoryListQuery,
  InventorySummary,
  StockInInput,
  StockOutInput,
  SupplierView,
} from '@/types/inventory'
import type {
  GuestReport,
  OccupancyReport,
  PaymentReport,
  ReportRange,
  ReservationReport,
  RevenueReport,
  RevenueReportQuery,
} from '@/types/reports'
import type { HotelSettings, SettingsInput } from '@/types/settings'
import type { StaffInput, StaffListQuery, StaffSummary, StaffView } from '@/types/staff'
import type { GuestHistory, GuestInput, GuestListQuery, GuestSummary } from '@/types/guest'
import type {
  BillAdjustmentInput,
  BillingSummary,
  Invoice,
  InvoiceListQuery,
  InvoiceSummary,
  PaymentInput,
  PaymentListQuery,
  PaymentRecord,
  RefundInput,
} from '@/types/billing'
import type { ReservationSummary } from '@/types/dashboard'
import type { CheckInInput, CheckInPreview, CheckOutInput, CheckOutResult, FrontDeskOverview, StayBill } from '@/types/frontDesk'
import type { AvailabilityQuery, AvailableRoom, ReservationDetails, ReservationInput, ReservationListQuery } from '@/types/reservation'
import type { RoomActivity, RoomInput, RoomListQuery } from '@/types/room'

/**
 * The contract every data source must implement.
 * Mock services (src/mock/services) and HTTP services (src/api/http) both satisfy it,
 * so switching data source is a configuration change (VITE_MOCK_API_ENABLED), not a code change.
 *
 * Each phase adds its module here (rooms, guests, reservations, ...).
 */
export interface SystemService {
  health(): Promise<HealthStatus>
}

/** Development sign-in (HTTP Basic against the demo users). */
export interface AuthService {
  /**
   * Checks the credentials (GET /api/auth/me) and returns the session to start.
   * Rejects with a 401 ApiError "Incorrect username or password". Does not store anything itself.
   */
  signIn(username: string, password: string): Promise<Session>
}

/** GET /api/dashboard/* */
export interface DashboardService {
  summary(): Promise<DashboardSummary>
  revenue(): Promise<RevenueSeries>
  occupancy(): Promise<OccupancySeries>
}

/** /api/rooms */
export interface RoomService {
  /** GET /api/rooms */
  list(query?: RoomListQuery): Promise<PageResponse<Room>>
  /** GET /api/rooms/{id} */
  get(id: string): Promise<Room>
  /** GET /api/rooms/floors: distinct floors, ascending (for filters). */
  floors(): Promise<number[]>
  /** GET /api/rooms/{id}/activity */
  activity(id: string): Promise<RoomActivity>
  /** POST /api/rooms */
  create(input: RoomInput): Promise<Room>
  /** PUT /api/rooms/{id} */
  update(id: string, input: RoomInput): Promise<Room>
  /** PATCH /api/rooms/{id}/status */
  updateStatus(id: string, status: RoomStatus): Promise<Room>
  /** DELETE /api/rooms/{id} */
  remove(id: string): Promise<void>
}

/** /api/guests */
export interface GuestService {
  /** GET /api/guests */
  list(query?: GuestListQuery): Promise<PageResponse<GuestSummary>>
  /** GET /api/guests/{id} */
  get(id: string): Promise<GuestSummary>
  /** GET /api/guests/nationalities: distinct values, alphabetical (for filters). */
  nationalities(): Promise<string[]>
  /** GET /api/guests/{id}/history: stay statistics and every reservation. */
  history(id: string): Promise<GuestHistory>
  /** POST /api/guests */
  create(input: GuestInput): Promise<GuestSummary>
  /** PUT /api/guests/{id} */
  update(id: string, input: GuestInput): Promise<GuestSummary>
  /** DELETE /api/guests/{id} */
  remove(id: string): Promise<void>
}

/** /api/reservations */
export interface ReservationService {
  /** GET /api/reservations */
  list(query?: ReservationListQuery): Promise<PageResponse<ReservationSummary>>
  /** GET /api/reservations/{id}: booking with guest contact, charges and payments. */
  get(id: string): Promise<ReservationDetails>
  /** GET /api/reservations/availability: bookable rooms for the dates and party size, with quotes. */
  availability(query: AvailabilityQuery): Promise<AvailableRoom[]>
  /** POST /api/reservations */
  create(input: ReservationInput): Promise<ReservationSummary>
  /** PUT /api/reservations/{id} (pending/confirmed bookings only) */
  update(id: string, input: ReservationInput): Promise<ReservationSummary>
  /** POST /api/reservations/{id}/cancel (pending/confirmed bookings only) */
  cancel(id: string): Promise<ReservationSummary>
}

/** /api/front-desk: arrivals, check-in and check-out */
export interface FrontDeskService {
  /** GET /api/front-desk/overview */
  overview(): Promise<FrontDeskOverview>
  /** GET /api/front-desk/check-in/{reservationId}: ID type on file and the rooms that can be assigned */
  checkInPreview(reservationId: string): Promise<CheckInPreview>
  /** POST /api/front-desk/check-in/{reservationId} */
  checkIn(reservationId: string, input: CheckInInput): Promise<ReservationSummary>
  /** GET /api/front-desk/check-out/{reservationId}: final bill if the guest leaves today */
  checkOutPreview(reservationId: string): Promise<StayBill>
  /** POST /api/front-desk/check-out/{reservationId}: settles the balance (mock gateway) and checks out */
  checkOut(reservationId: string, input: CheckOutInput): Promise<CheckOutResult>
}

/** /api/billing and /api/payments: invoices, folio adjustments, payments and refunds (mock gateway) */
export interface BillingService {
  /** GET /api/billing/summary */
  summary(): Promise<BillingSummary>
  /** GET /api/billing/invoices */
  invoices(query?: InvoiceListQuery): Promise<PageResponse<InvoiceSummary>>
  /** GET /api/billing/invoices/{reservationId} */
  invoice(reservationId: string): Promise<Invoice>
  /** POST /api/billing/invoices/{reservationId}/adjustments: extra charge or discount */
  addAdjustment(reservationId: string, input: BillAdjustmentInput): Promise<Invoice>
  /** DELETE /api/billing/invoices/{reservationId}/adjustments/{adjustmentId} */
  removeAdjustment(reservationId: string, adjustmentId: string): Promise<Invoice>
  /** POST /api/billing/invoices/{reservationId}/payments */
  recordPayment(reservationId: string, input: PaymentInput): Promise<Payment>
  /** POST /api/billing/invoices/{reservationId}/refund: refunds the whole credit balance */
  refund(reservationId: string, input: RefundInput): Promise<Payment>
  /** GET /api/payments */
  payments(query?: PaymentListQuery): Promise<PageResponse<PaymentRecord>>
  /** PATCH /api/payments/{id}/status: confirm or fail a pending payment */
  updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<Payment>
}

/** /api/housekeeping: cleaning schedule and task tracking */
export interface HousekeepingService {
  /** GET /api/housekeeping/tasks */
  list(query?: HousekeepingListQuery): Promise<PageResponse<HousekeepingTaskView>>
  /** GET /api/housekeeping/summary?date= : counts and staff workload for a day (default today) */
  summary(date?: string): Promise<HousekeepingSummary>
  /** POST /api/housekeeping/tasks */
  create(input: HousekeepingTaskInput): Promise<HousekeepingTaskView>
  /** PUT /api/housekeeping/tasks/{id} (not completed tasks) */
  update(id: string, input: HousekeepingTaskInput): Promise<HousekeepingTaskView>
  /** PATCH /api/housekeeping/tasks/{id}/status */
  updateStatus(id: string, status: HousekeepingStatus): Promise<HousekeepingTaskView>
  /** DELETE /api/housekeeping/tasks/{id} (pending tasks only) */
  remove(id: string): Promise<void>
}

/** /api/restaurant: menu and orders charged to in-house stays */
export interface RestaurantService {
  /** GET /api/restaurant/summary */
  summary(): Promise<RestaurantSummary>
  /** GET /api/restaurant/menu */
  menu(query?: MenuListQuery): Promise<PageResponse<MenuItemView>>
  /** POST /api/restaurant/menu */
  createMenuItem(input: MenuItemInput): Promise<MenuItemView>
  /** PUT /api/restaurant/menu/{id} */
  updateMenuItem(id: string, input: MenuItemInput): Promise<MenuItemView>
  /** PATCH /api/restaurant/menu/{id}/availability */
  setMenuItemAvailability(id: string, available: boolean): Promise<MenuItemView>
  /** DELETE /api/restaurant/menu/{id} (items never ordered only) */
  removeMenuItem(id: string): Promise<void>
  /** GET /api/restaurant/orders */
  orders(query?: OrderListQuery): Promise<PageResponse<OrderView>>
  /** POST /api/restaurant/orders */
  createOrder(input: OrderInput): Promise<OrderView>
  /** PATCH /api/restaurant/orders/{id}/status */
  updateOrderStatus(id: string, status: OrderStatus): Promise<OrderView>
}

/** /api/staff */
export interface StaffService {
  /** GET /api/staff */
  list(query?: StaffListQuery): Promise<PageResponse<StaffView>>
  /** GET /api/staff/summary */
  summary(): Promise<StaffSummary>
  /** GET /api/staff/{id} */
  get(id: string): Promise<StaffView>
  /** POST /api/staff */
  create(input: StaffInput): Promise<StaffView>
  /** PUT /api/staff/{id} */
  update(id: string, input: StaffInput): Promise<StaffView>
  /** DELETE /api/staff/{id} (no task history only) */
  remove(id: string): Promise<void>
}

/** /api/inventory */
export interface InventoryService {
  /** GET /api/inventory/items */
  list(query?: InventoryListQuery): Promise<PageResponse<InventoryItemView>>
  /** GET /api/inventory/summary: totals and the reorder list */
  summary(): Promise<InventorySummary>
  /** GET /api/inventory/suppliers */
  suppliers(): Promise<SupplierView[]>
  /** GET /api/inventory/items/{id}/movements */
  movements(itemId: string): Promise<StockMovement[]>
  /** POST /api/inventory/items (quantity = opening stock) */
  create(input: InventoryItemInput): Promise<InventoryItemView>
  /** PUT /api/inventory/items/{id} (quantity is not changed) */
  update(id: string, input: InventoryItemInput): Promise<InventoryItemView>
  /** POST /api/inventory/items/{id}/stock-in */
  stockIn(id: string, input: StockInInput): Promise<InventoryItemView>
  /** POST /api/inventory/items/{id}/stock-out */
  stockOut(id: string, input: StockOutInput): Promise<InventoryItemView>
  /** DELETE /api/inventory/items/{id} (no stock, no history) */
  remove(id: string): Promise<void>
}

/** /api/reports: read-only analytics over an inclusive date range (?from=yyyy-MM-dd&to=yyyy-MM-dd) */
export interface ReportService {
  /** GET /api/reports/revenue?from=&to=&groupBy=DAY|MONTH|YEAR */
  revenue(query: RevenueReportQuery): Promise<RevenueReport>
  /** GET /api/reports/occupancy?from=&to= */
  occupancy(range: ReportRange): Promise<OccupancyReport>
  /** GET /api/reports/reservations?from=&to= (by arrival date) */
  reservations(range: ReportRange): Promise<ReservationReport>
  /** GET /api/reports/guests?from=&to= (guests arriving in the range) */
  guests(range: ReportRange): Promise<GuestReport>
  /** GET /api/reports/payments?from=&to= (by payment date) */
  payments(range: ReportRange): Promise<PaymentReport>
}

/** /api/settings: hotel profile, check-in/check-out times and the (read-only) tax configuration */
export interface SettingsService {
  /** GET /api/settings */
  get(): Promise<HotelSettings>
  /** PUT /api/settings: hotel profile and check-in/check-out times (Admin) */
  update(input: SettingsInput): Promise<HotelSettings>
}

/**
 * Controls for the browser's copy of the demo data. Only available in mock mode:
 * when the backend is connected it is the source of truth and the browser keeps no data.
 */
export interface DemoDataControls {
  /** yyyy-MM-dd the current demo data was generated against. */
  seededOn(): string
  /** Discards all local changes and restores the canonical seed. */
  reset(): Promise<{ seededOn: string }>
  /** Notifies when another tab changes the demo data. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void
}

export interface ServiceProvider {
  system: SystemService
  auth: AuthService
  dashboard: DashboardService
  rooms: RoomService
  guests: GuestService
  reservations: ReservationService
  frontDesk: FrontDeskService
  billing: BillingService
  housekeeping: HousekeepingService
  restaurant: RestaurantService
  staff: StaffService
  inventory: InventoryService
  reports: ReportService
  settings: SettingsService
}
