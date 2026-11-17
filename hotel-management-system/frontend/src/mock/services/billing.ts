import type { BillingService } from '@/api/types'
import { calculateStayBill, paymentRecords } from '@/mock/calculations/billing'
import { completedRevenue } from '@/mock/calculations/dashboard'
import { applyListQuery, nextId } from '@/mock/collection'
import { getDatabase, mutateDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import { mockPaymentGateway } from '@/mock/payments/mockPaymentGateway'
import type { MockDatabase } from '@/mock/seed'
import { parseOrThrow } from '@/mock/validation'
import { adjustmentInputSchema, paymentInputSchema, refundInputSchema } from '@/schemas/billing'
import { ApiError } from '@/types/api'
import {
  invoiceNumberFor,
  type BalanceState,
  type BillAdjustment,
  type BillAdjustmentInput,
  type BillingSummary,
  type Invoice,
  type InvoiceListQuery,
  type InvoiceState,
  type InvoiceSummary,
  type PaymentInput,
  type PaymentListQuery,
  type RefundInput,
} from '@/types/billing'
import type { Payment, Reservation } from '@/types/domain'
import { PAYMENT_STATUSES, type PaymentStatus } from '@/types/enums'
import { monthKey, nowISODateTime, todayISO } from '@/utils/date'
import { enumLabel, formatCurrency } from '@/utils/format'
import { percentOf, roundMoney } from '@/utils/money'

/**
 * Mock implementation of /api/billing and /api/payments.
 * - Invoices are derived from bookings (never stored): INV-0013 belongs to BK-0013.
 * - Extras and discounts can be posted while the folio is open (upcoming or in-house stays); final invoices are locked.
 * - Payments go through the mock gateway and may not exceed the balance due; credit balances are refunded in full.
 * - Refunds are stored as negative completed payments, so revenue figures are always net.
 * - Pending payments (e.g. bank transfers) can be confirmed or marked failed.
 */

const STATE_BY_STATUS: Record<Reservation['status'], InvoiceState> = {
  PENDING: 'ESTIMATE',
  CONFIRMED: 'ESTIMATE',
  CHECKED_IN: 'INTERIM',
  CHECKED_OUT: 'FINAL',
  CANCELLED: 'VOID',
}

const balanceState = (balance: number): BalanceState => (balance > 0 ? 'DUE' : balance < 0 ? 'CREDIT' : 'SETTLED')

function findReservation(db: MockDatabase, id: string): Reservation {
  const reservation = db.reservations.find((r) => r.id === id)
  if (!reservation) throw new ApiError(404, `Invoice for booking '${id}' was not found`)
  return reservation
}

/** In-house folios run to the booked departure, or to today once the guest has overstayed. */
function billFor(db: MockDatabase, reservation: Reservation) {
  const today = todayISO()
  const until = reservation.status === 'CHECKED_IN' && reservation.checkOut < today ? today : reservation.checkOut
  return calculateStayBill(db, reservation, until)
}

function toSummary(db: MockDatabase, reservation: Reservation): InvoiceSummary {
  const bill = billFor(db, reservation)
  const room = db.rooms.find((r) => r.id === reservation.roomId)
  return {
    reservationId: reservation.id,
    invoiceNumber: invoiceNumberFor(reservation.id),
    guestId: reservation.guestId,
    guestName: bill.guestName,
    roomNumber: bill.roomNumber,
    roomType: room?.type ?? 'STANDARD',
    checkIn: reservation.checkIn,
    checkOut: bill.checkOut,
    bookingStatus: reservation.status,
    state: STATE_BY_STATUS[reservation.status],
    total: bill.total,
    paid: bill.paid,
    balance: bill.balance,
    balanceState: balanceState(bill.balance),
  }
}

/** Bookings that have a folio worth listing: stays that started, or anything with payments or adjustments. */
function hasFolio(db: MockDatabase, r: Reservation): boolean {
  return (
    r.status === 'CHECKED_IN' ||
    r.status === 'CHECKED_OUT' ||
    db.payments.some((p) => p.reservationId === r.id) ||
    db.billAdjustments.some((a) => a.reservationId === r.id)
  )
}

// ------------------------------------------------------------------ queries

function summary(): BillingSummary {
  const db = getDatabase()
  const invoices = db.reservations.map((r) => toSummary(db, r))
  const owed = invoices.filter((i) => (i.state === 'INTERIM' || i.state === 'FINAL') && i.balance > 0)
  const credit = invoices.filter((i) => i.balance < 0)
  const pending = db.payments.filter((p) => p.status === 'PENDING')
  const month = monthKey(todayISO())
  return {
    outstandingTotal: roundMoney(owed.reduce((s, i) => s + i.balance, 0)),
    outstandingCount: owed.length,
    creditTotal: roundMoney(credit.reduce((s, i) => s - i.balance, 0)),
    creditCount: credit.length,
    collectedThisMonth: completedRevenue(db.payments, (p) => monthKey(p.paymentDate) === month),
    pendingTotal: roundMoney(pending.reduce((s, p) => s + p.amount, 0)),
    pendingCount: pending.length,
  }
}

function invoices(query: InvoiceListQuery = {}) {
  const db = getDatabase()
  const { balance, state } = query
  return applyListQuery(
    db.reservations.filter((r) => hasFolio(db, r)).map((r) => toSummary(db, r)),
    query,
    {
      searchFields: (i) => [i.invoiceNumber, i.reservationId, i.guestName, i.roomNumber],
      filter: (i) => (!balance || i.balanceState === balance) && (!state || i.state === state),
      defaultSort: (a, b) => b.checkIn.localeCompare(a.checkIn) || b.reservationId.localeCompare(a.reservationId),
    },
  )
}

function invoice(reservationId: string): Invoice {
  const db = getDatabase()
  const reservation = findReservation(db, reservationId)
  const guest = db.guests.find((g) => g.id === reservation.guestId)
  const base = toSummary(db, reservation)
  const { hotel } = db.settings
  return {
    ...base,
    issuedOn: base.state === 'FINAL' ? (reservation.checkedOutAt?.slice(0, 10) ?? reservation.checkOut) : todayISO(),
    hotel: { name: hotel.name, address: hotel.address, phone: hotel.phone, email: hotel.email, gstin: hotel.gstin },
    guest: {
      id: reservation.guestId,
      fullName: guest?.fullName ?? 'Unknown guest',
      email: guest?.email ?? '',
      phone: guest?.phone ?? '',
      address: guest?.address ?? '',
    },
    bill: billFor(db, reservation),
    editable: base.state === 'ESTIMATE' || base.state === 'INTERIM',
  }
}

function payments(query: PaymentListQuery = {}) {
  const db = getDatabase()
  const { status, method, from, to } = query
  const records = paymentRecords(db)
  return applyListQuery(records, query, {
    searchFields: (p) => [p.id, p.reservationId, p.invoiceNumber, p.guestName, p.roomNumber, p.transactionReference],
    filter: (p) =>
      (!status || p.status === status) &&
      (!method || p.method === method) &&
      (!from || p.paymentDate.slice(0, 10) >= from) &&
      (!to || p.paymentDate.slice(0, 10) <= to),
    sortAccessors: { status: (p) => PAYMENT_STATUSES.indexOf(p.status) },
    defaultSort: (a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id.localeCompare(a.id),
  })
}

// ------------------------------------------------------------------ commands

function assertEditable(reservation: Reservation) {
  const state = STATE_BY_STATUS[reservation.status]
  if (state === 'FINAL') throw new ApiError(409, `${invoiceNumberFor(reservation.id)} is final. Charges can't be changed after check-out.`)
  if (state === 'VOID') throw new ApiError(409, `${reservation.id} is cancelled; its invoice has no charges.`)
}

function addAdjustment(reservationId: string, raw: BillAdjustmentInput): Invoice {
  const db = getDatabase()
  const reservation = findReservation(db, reservationId)
  assertEditable(reservation)
  const input = parseOrThrow(adjustmentInputSchema, raw)

  if (input.kind === 'DISCOUNT') {
    const bill = billFor(db, reservation)
    const remaining = roundMoney(bill.roomCharges - bill.discount)
    const wanted = input.amount ?? percentOf(bill.roomCharges, input.percent ?? 0)
    if (wanted > remaining) {
      const message = `Discounts can't exceed the room charges (${formatCurrency(remaining)} left to discount)`
      throw new ApiError(400, 'Validation failed', { [input.amount !== undefined ? 'amount' : 'percent']: message })
    }
  }

  mutateDatabase((draft) => {
    const id = nextId(draft.billAdjustments.map((a) => a.id), 'ADJ')
    const createdAt = nowISODateTime()
    const adjustment: BillAdjustment =
      input.kind === 'EXTRA'
        ? { id, reservationId, createdAt, kind: 'EXTRA', description: input.description, amount: input.amount, gstPercent: input.gstPercent }
        : {
            id,
            reservationId,
            createdAt,
            kind: 'DISCOUNT',
            description: input.description,
            ...(input.amount !== undefined ? { amount: input.amount } : { percent: input.percent }),
          }
    draft.billAdjustments.push(adjustment)
  })
  return invoice(reservationId)
}

function removeAdjustment(reservationId: string, adjustmentId: string): Invoice {
  const db = getDatabase()
  const reservation = findReservation(db, reservationId)
  assertEditable(reservation)
  if (!db.billAdjustments.some((a) => a.id === adjustmentId && a.reservationId === reservationId)) {
    throw new ApiError(404, `Adjustment '${adjustmentId}' was not found on ${invoiceNumberFor(reservationId)}`)
  }
  mutateDatabase((draft) => {
    draft.billAdjustments = draft.billAdjustments.filter((a) => a.id !== adjustmentId)
  })
  return invoice(reservationId)
}

function insertPayment(payment: Omit<Payment, 'id'>): Payment {
  return mutateDatabase((draft) => {
    const created = { ...payment, id: nextId(draft.payments.map((p) => p.id), 'PAY') }
    draft.payments.push(created)
    return created
  })
}

function recordPayment(reservationId: string, raw: PaymentInput): Payment {
  const db = getDatabase()
  const reservation = findReservation(db, reservationId)
  if (reservation.status === 'CANCELLED') throw new ApiError(409, `${reservation.id} is cancelled; no payment can be taken.`)
  const { amount, method } = parseOrThrow(paymentInputSchema, raw)
  const { balance } = billFor(db, reservation)
  if (balance <= 0) throw new ApiError(409, `${invoiceNumberFor(reservationId)} has nothing to pay.`)
  if (amount > balance) {
    throw new ApiError(400, 'Validation failed', { amount: `At most ${formatCurrency(balance)} (the balance due)` })
  }
  const result = mockPaymentGateway.charge({ amount, method, reference: reservationId })
  if (!result.approved) throw new ApiError(402, `Payment declined: ${result.declineReason}`)
  return insertPayment({
    reservationId,
    amount,
    method,
    paymentDate: nowISODateTime(),
    status: 'COMPLETED',
    transactionReference: result.transactionReference,
  })
}

function refund(reservationId: string, raw: RefundInput): Payment {
  const db = getDatabase()
  const reservation = findReservation(db, reservationId)
  const { method } = parseOrThrow(refundInputSchema, raw)
  const { balance } = billFor(db, reservation)
  if (balance >= 0) throw new ApiError(409, `${invoiceNumberFor(reservationId)} has no credit to refund.`)
  const amount = -balance
  const result = mockPaymentGateway.refund({ amount, method, reference: reservationId })
  if (!result.approved) throw new ApiError(402, `Refund declined: ${result.declineReason}`)
  return insertPayment({
    reservationId,
    amount: -amount,
    method,
    paymentDate: nowISODateTime(),
    status: 'COMPLETED',
    transactionReference: result.transactionReference,
  })
}

function updatePaymentStatus(paymentId: string, status: PaymentStatus): Payment {
  const db = getDatabase()
  const payment = db.payments.find((p) => p.id === paymentId)
  if (!payment) throw new ApiError(404, `Payment with id '${paymentId}' was not found`)
  if (payment.status !== 'PENDING') {
    throw new ApiError(409, `${paymentId} is ${enumLabel(payment.status).toLowerCase()}; only pending payments can be confirmed or failed.`)
  }
  if (status !== 'COMPLETED' && status !== 'FAILED') {
    throw new ApiError(400, 'Validation failed', { status: 'A pending payment can only become Completed or Failed' })
  }
  return mutateDatabase((draft) => {
    const target = draft.payments.find((p) => p.id === paymentId)!
    target.status = status
    return target
  })
}

export const mockBillingService: BillingService = {
  summary: () => mockCall(summary),
  invoices: (query) => mockCall(() => invoices(query)),
  invoice: (id) => mockCall(() => invoice(id)),
  addAdjustment: (id, input) => mockCall(() => addAdjustment(id, input)),
  removeAdjustment: (id, adjustmentId) => mockCall(() => removeAdjustment(id, adjustmentId)),
  recordPayment: (id, input) => mockCall(() => recordPayment(id, input)),
  refund: (id, input) => mockCall(() => refund(id, input)),
  payments: (query) => mockCall(() => payments(query)),
  updatePaymentStatus: (id, status) => mockCall(() => updatePaymentStatus(id, status)),
}
