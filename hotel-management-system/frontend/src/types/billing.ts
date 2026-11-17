import type { ListQuery } from './api'
import type { ISODate, ISODateTime, Payment } from './domain'
import type { BookingStatus, OrderStatus, PaymentMethod, PaymentStatus, RoomType } from './enums'

/** GST rates the hotel may apply to extra charges. */
export const EXTRA_GST_RATES = [0, 5, 12, 18] as const
export type ExtraGstRate = (typeof EXTRA_GST_RATES)[number]

/**
 * Stored folio adjustment: an extra charge (minibar, laundry, spa…) or a discount on room charges.
 * A discount is either a fixed amount or a percentage of the room charges (re-applied if the nights change).
 */
export type BillAdjustment =
  | {
      id: string
      reservationId: string
      kind: 'EXTRA'
      description: string
      amount: number
      gstPercent: ExtraGstRate
      createdAt: ISODateTime
    }
  | {
      id: string
      reservationId: string
      kind: 'DISCOUNT'
      description: string
      /** Fixed discount in rupees, or… */
      amount?: number
      /** …a percentage of room charges. Exactly one is set. */
      percent?: number
      createdAt: ISODateTime
    }

/** Body of POST /api/billing/invoices/{reservationId}/adjustments */
export type BillAdjustmentInput =
  | { kind: 'EXTRA'; description: string; amount: number; gstPercent: ExtraGstRate }
  | { kind: 'DISCOUNT'; description: string; amount?: number; percent?: number }

export type BillLineKind = 'ROOM' | 'DISCOUNT' | 'ROOM_GST' | 'FOOD' | 'FOOD_GST' | 'EXTRA' | 'EXTRA_GST'

export interface BillLine {
  kind: BillLineKind
  description: string
  /** Negative for discounts. */
  amount: number
  /** Set on lines that come from an adjustment (they can be removed while the folio is open). */
  adjustmentId?: string
}

export interface BillOrder {
  id: string
  orderedAt: string
  status: OrderStatus
  itemCount: number
  amount: number
}

/** Taxable value and GST per rate; shown on invoices split equally into CGST and SGST (intra-state supply). */
export interface TaxSummaryRow {
  percent: number
  taxable: number
  tax: number
}

/** The folio of a stay: every charge, discount, tax and payment. */
export interface StayBill {
  reservationId: string
  guestName: string
  roomNumber: string
  status: BookingStatus
  checkIn: ISODate
  /** Departure date the bill is calculated for (today for an early or late check-out). */
  checkOut: ISODate
  /** Booked departure date, for comparison. */
  bookedCheckOut: ISODate
  nights: number
  roomRate: number
  lines: BillLine[]
  roomCharges: number
  /** Total discount applied to room charges (never more than the room charges). */
  discount: number
  roomGstPercent: number
  roomGst: number
  foodCharges: number
  foodGstPercent: number
  foodGst: number
  extraCharges: number
  extraGst: number
  taxSummary: TaxSummaryRow[]
  total: number
  /** Sum of completed payments, net of refunds. */
  paid: number
  /** total - paid; negative means the guest is in credit. */
  balance: number
  payments: Payment[]
  /** Restaurant orders charged to the stay (cancelled orders excluded). */
  orders: BillOrder[]
}

/**
 * Invoice state:
 * - ESTIMATE: upcoming booking (charges as booked);
 * - INTERIM: guest in-house, folio still open;
 * - FINAL: stay completed, charges locked;
 * - VOID: booking cancelled, no charges (any deposit is refundable).
 */
export type InvoiceState = 'ESTIMATE' | 'INTERIM' | 'FINAL' | 'VOID'

export type BalanceState = 'DUE' | 'SETTLED' | 'CREDIT'

export interface InvoiceSummary {
  reservationId: string
  invoiceNumber: string
  guestId: string
  guestName: string
  roomNumber: string
  roomType: RoomType
  checkIn: ISODate
  checkOut: ISODate
  bookingStatus: BookingStatus
  state: InvoiceState
  total: number
  paid: number
  balance: number
  balanceState: BalanceState
}

export interface Invoice extends InvoiceSummary {
  /** Check-out date for final invoices, otherwise today. */
  issuedOn: ISODate
  hotel: { name: string; address: string; phone: string; email: string; gstin: string }
  guest: { id: string; fullName: string; email: string; phone: string; address: string }
  bill: StayBill
  /** Charges and discounts can still be changed (estimate or interim). */
  editable: boolean
}

export type InvoiceSortField = 'invoiceNumber' | 'guestName' | 'checkIn' | 'checkOut' | 'total' | 'balance'

/** GET /api/billing/invoices?search=&balance=&state=&page=&size=&sort= */
export type InvoiceListQuery = ListQuery<InvoiceSortField> & { balance?: BalanceState; state?: InvoiceState }

/** GET /api/billing/summary */
export interface BillingSummary {
  /** Sum of positive balances on bookings that are not cancelled. */
  outstandingTotal: number
  outstandingCount: number
  /** Money owed back to guests (credit balances). */
  creditTotal: number
  creditCount: number
  /** Completed payments this calendar month, net of refunds. */
  collectedThisMonth: number
  /** Payments awaiting confirmation (e.g. bank transfers). */
  pendingTotal: number
  pendingCount: number
}

/** POST /api/billing/invoices/{reservationId}/payments */
export interface PaymentInput {
  amount: number
  method: PaymentMethod
}

/** POST /api/billing/invoices/{reservationId}/refund: refunds the full credit balance. */
export interface RefundInput {
  method: PaymentMethod
}

/** Payment history row (GET /api/payments). Refunds are negative amounts. */
export interface PaymentRecord {
  id: string
  reservationId: string
  invoiceNumber: string
  guestName: string
  roomNumber: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paymentDate: ISODateTime
  transactionReference: string
}

export type PaymentSortField = 'paymentDate' | 'amount' | 'guestName' | 'method' | 'status'

/** GET /api/payments?search=&status=&method=&from=&to=&page=&size=&sort= */
export type PaymentListQuery = ListQuery<PaymentSortField> & {
  status?: PaymentStatus
  method?: PaymentMethod
  from?: ISODate
  to?: ISODate
}

/** Invoice numbers are derived from the booking number: BK-0013 -> INV-0013. */
export function invoiceNumberFor(reservationId: string): string {
  return reservationId.replace(/^BK-/, 'INV-')
}
