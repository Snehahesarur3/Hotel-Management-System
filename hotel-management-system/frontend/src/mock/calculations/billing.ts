import type { MockDatabase } from '@/mock/seed'
import { invoiceNumberFor, type BillLine, type PaymentRecord, type StayBill, type TaxSummaryRow } from '@/types/billing'
import type { ISODate, Reservation, RestaurantOrder } from '@/types/domain'
import { quoteStay } from '@/utils/charges'
import { addDays } from '@/utils/date'
import { formatCurrency } from '@/utils/format'
import { percentOf, roundMoney, sumMoney } from '@/utils/money'
import { completedRevenue } from './dashboard'

/**
 * Folio calculation for a stay, shared by check-out, invoices and billing lists.
 *
 *   room charges (rate x nights)
 *   - discounts (fixed or % of room charges, capped at the room charges)
 *   + room GST (slab by nightly rate, on the discounted room value)
 *   + restaurant orders (cancelled excluded) + food GST (on the food total)
 *   + extra charges + GST at each extra's rate
 *   - completed payments (refunds are negative payments)
 *
 * Cancelled bookings carry no charges, so any deposit shows as a credit to refund.
 * With no adjustments this is exactly the seed generator's formula, so seeded settlements reconcile to zero.
 */

/** Every payment with its guest, room and invoice number (refunds are negative amounts). */
export function paymentRecords(db: MockDatabase): PaymentRecord[] {
  const reservations = new Map(db.reservations.map((r) => [r.id, r]))
  const guests = new Map(db.guests.map((g) => [g.id, g]))
  const rooms = new Map(db.rooms.map((r) => [r.id, r]))
  return db.payments.map((p) => {
    const reservation = reservations.get(p.reservationId)
    return {
      id: p.id,
      reservationId: p.reservationId,
      invoiceNumber: invoiceNumberFor(p.reservationId),
      guestName: (reservation && guests.get(reservation.guestId)?.fullName) ?? 'Unknown guest',
      roomNumber: (reservation && rooms.get(reservation.roomId)?.roomNumber) ?? '—',
      amount: p.amount,
      method: p.method,
      status: p.status,
      paymentDate: p.paymentDate,
      transactionReference: p.transactionReference,
    }
  })
}

export function orderAmount(order: RestaurantOrder): number {
  return sumMoney(order.items.map((line) => line.quantity * line.unitPrice))
}

function addTax(rows: TaxSummaryRow[], percent: number, taxable: number, tax: number) {
  if (taxable === 0) return
  const row = rows.find((r) => r.percent === percent)
  if (row) {
    row.taxable = roundMoney(row.taxable + taxable)
    row.tax = roundMoney(row.tax + tax)
  } else {
    rows.push({ percent, taxable, tax })
  }
}

export function calculateStayBill(db: MockDatabase, reservation: Reservation, checkOut: ISODate = reservation.checkOut): StayBill {
  const room = db.rooms.find((r) => r.id === reservation.roomId)
  const guest = db.guests.find((g) => g.id === reservation.guestId)
  const cancelled = reservation.status === 'CANCELLED'
  const adjustments = cancelled ? [] : db.billAdjustments.filter((a) => a.reservationId === reservation.id)
  const lines: BillLine[] = []
  const taxSummary: TaxSummaryRow[] = []

  // Room. A day-use stay (in and out on the same date) is billed as one night.
  const minimumCheckOut = addDays(reservation.checkIn, 1)
  const billedUntil = checkOut > minimumCheckOut ? checkOut : minimumCheckOut
  const quote = quoteStay(reservation.roomRate, reservation.checkIn, billedUntil, db.settings.taxes.roomGstSlabs)
  const roomCharges = cancelled ? 0 : quote.roomCharges
  const nightsLabel = `${quote.nights} night${quote.nights === 1 ? '' : 's'}`
  if (!cancelled) {
    lines.push({
      kind: 'ROOM',
      description: `Room ${room?.roomNumber ?? ''} · ${nightsLabel} × ${formatCurrency(reservation.roomRate)}`,
      amount: roomCharges,
    })
  }

  // Discounts on room charges, applied in the order they were given and never beyond the room charges.
  let discount = 0
  for (const adj of adjustments) {
    if (adj.kind !== 'DISCOUNT') continue
    const wanted = adj.amount ?? percentOf(roomCharges, adj.percent ?? 0)
    const applied = Math.min(wanted, roundMoney(roomCharges - discount))
    discount = roundMoney(discount + applied)
    lines.push({
      kind: 'DISCOUNT',
      description: adj.percent !== undefined ? `${adj.description} (${adj.percent}% of room charges)` : adj.description,
      amount: -applied,
      adjustmentId: adj.id,
    })
  }
  const roomTaxable = roundMoney(roomCharges - discount)
  const roomGstPercent = quote.gstPercent
  const roomGst = percentOf(roomTaxable, roomGstPercent)
  if (!cancelled) {
    lines.push({ kind: 'ROOM_GST', description: `GST on room (${roomGstPercent}%)`, amount: roomGst })
    addTax(taxSummary, roomGstPercent, roomTaxable, roomGst)
  }

  // Restaurant.
  const orders = cancelled
    ? []
    : db.restaurantOrders
        .filter((o) => o.reservationId === reservation.id && o.status !== 'CANCELLED')
        .sort((a, b) => a.orderedAt.localeCompare(b.orderedAt))
  const foodCharges = sumMoney(orders.map(orderAmount))
  const foodGstPercent = db.settings.taxes.foodGstPercent
  const foodGst = percentOf(foodCharges, foodGstPercent)
  if (orders.length > 0) {
    lines.push(
      { kind: 'FOOD', description: `Restaurant & room service (${orders.length} order${orders.length === 1 ? '' : 's'})`, amount: foodCharges },
      { kind: 'FOOD_GST', description: `GST on food (${foodGstPercent}%)`, amount: foodGst },
    )
    addTax(taxSummary, foodGstPercent, foodCharges, foodGst)
  }

  // Extra charges, each with its own GST rate; GST lines grouped by rate.
  const extras = adjustments.filter((a) => a.kind === 'EXTRA')
  const extraGstByRate = new Map<number, number>()
  for (const extra of extras) {
    lines.push({ kind: 'EXTRA', description: extra.description, amount: extra.amount, adjustmentId: extra.id })
    const tax = percentOf(extra.amount, extra.gstPercent)
    extraGstByRate.set(extra.gstPercent, roundMoney((extraGstByRate.get(extra.gstPercent) ?? 0) + tax))
    addTax(taxSummary, extra.gstPercent, extra.amount, tax)
  }
  for (const [rate, tax] of [...extraGstByRate].sort((a, b) => a[0] - b[0])) {
    if (rate > 0) lines.push({ kind: 'EXTRA_GST', description: `GST on extras (${rate}%)`, amount: tax })
  }
  const extraCharges = sumMoney(extras.map((e) => e.amount))
  const extraGst = sumMoney([...extraGstByRate.values()])

  const payments = db.payments
    .filter((p) => p.reservationId === reservation.id)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
  const paid = completedRevenue(payments)
  const total = sumMoney(lines.map((l) => l.amount))

  return {
    reservationId: reservation.id,
    guestName: guest?.fullName ?? 'Unknown guest',
    roomNumber: room?.roomNumber ?? '—',
    status: reservation.status,
    checkIn: reservation.checkIn,
    checkOut,
    bookedCheckOut: reservation.checkOut,
    nights: cancelled ? 0 : quote.nights,
    roomRate: reservation.roomRate,
    lines,
    roomCharges,
    discount,
    roomGstPercent,
    roomGst: cancelled ? 0 : roomGst,
    foodCharges,
    foodGstPercent,
    foodGst,
    extraCharges,
    extraGst,
    taxSummary: taxSummary.sort((a, b) => a.percent - b.percent),
    total,
    paid,
    balance: roundMoney(total - paid),
    payments,
    orders: orders.map((o) => ({
      id: o.id,
      orderedAt: o.orderedAt,
      status: o.status,
      itemCount: o.items.reduce((n, line) => n + line.quantity, 0),
      amount: orderAmount(o),
    })),
  }
}
