import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import { STORAGE_KEY } from '@/mock/storage'
import { mockBillingService as billing } from './billing'
import { mockFrontDeskService as frontDesk } from './frontDesk'
import { mockReservationService as reservations } from './reservations'

const payments = () => getDatabase().payments

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('invoices', () => {
  it('lists folios for stays and for bookings with payments', async () => {
    const page = await billing.invoices({ size: 100 })
    expect(page.totalElements).toBe(29)
    // Every completed stay in the seed was settled at check-out.
    expect(page.content.filter((i) => i.state === 'FINAL').every((i) => i.balanceState === 'SETTLED')).toBe(true)
    expect((await billing.invoices({ search: 'INV-0013' })).content.map((i) => i.reservationId)).toEqual(['BK-0013'])
    const due = await billing.invoices({ balance: 'DUE', state: 'INTERIM', size: 50 })
    expect(due.content.every((i) => i.balance > 0 && i.state === 'INTERIM')).toBe(true)
  })

  it('builds an interim invoice with hotel GSTIN, guest details and a tax summary', async () => {
    const invoice = await billing.invoice('BK-0013')
    expect(invoice).toMatchObject({
      invoiceNumber: 'INV-0013',
      state: 'INTERIM',
      editable: true,
      hotel: { name: 'Aurelia Bay Hotel', gstin: '30ABCDE1234F1Z5' },
      guest: { fullName: 'Arjun Reddy' },
      total: 17927, // 4 nights 14,000 + 12% GST 1,680 + food 2,140 + 5% GST 107
      paid: 3920,
      balance: 14007,
      balanceState: 'DUE',
    })
    expect(invoice.bill.taxSummary).toEqual([
      { percent: 5, taxable: 2140, tax: 107 },
      { percent: 12, taxable: 14000, tax: 1680 },
    ])
  })

  it('voids a cancelled booking’s charges and returns 404 for unknown bookings', async () => {
    const invoice = await billing.invoice('BK-0039')
    expect(invoice).toMatchObject({ state: 'VOID', total: 0, paid: 0, balance: 0, editable: false })
    await expect(billing.invoice('BK-9999')).rejects.toMatchObject({ status: 404 })
  })
})

describe('extras and discounts', () => {
  it('adds extras with their own GST rate and discounts that reduce taxable room value', async () => {
    let invoice = await billing.addAdjustment('BK-0013', { kind: 'EXTRA', description: 'Laundry', amount: 500, gstPercent: 18 })
    expect(invoice.total).toBe(18517)
    invoice = await billing.addAdjustment('BK-0013', { kind: 'DISCOUNT', description: 'Loyalty', percent: 10 })
    // Room 14,000 - 1,400 = 12,600 taxable at 12% (1,512); food 2,247; laundry 590.
    expect(invoice.bill).toMatchObject({ discount: 1400, roomGst: 1512, extraCharges: 500, extraGst: 90, total: 16949 })
    expect(invoice.bill.lines.map((l) => l.kind)).toEqual(['ROOM', 'DISCOUNT', 'ROOM_GST', 'FOOD', 'FOOD_GST', 'EXTRA', 'EXTRA_GST'])
    expect(invoice.bill.taxSummary.find((r) => r.percent === 18)).toEqual({ percent: 18, taxable: 500, tax: 90 })

    // Check-out bills the same adjustments.
    const bill = await frontDesk.checkOutPreview('BK-0013')
    expect(bill.lines.filter((l) => l.adjustmentId)).toHaveLength(2)

    const discountId = invoice.bill.lines.find((l) => l.kind === 'DISCOUNT')!.adjustmentId!
    invoice = await billing.removeAdjustment('BK-0013', discountId)
    expect(invoice.total).toBe(18517)
  })

  it('validates adjustments and caps discounts at the room charges', async () => {
    await expect(billing.addAdjustment('BK-0013', { kind: 'DISCOUNT', description: 'Goodwill', amount: 20000 })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { amount: "Discounts can't exceed the room charges (₹14,000.00 left to discount)" },
    })
    await expect(billing.addAdjustment('BK-0013', { kind: 'DISCOUNT', description: 'Both', amount: 100, percent: 5 })).rejects.toMatchObject({
      fieldErrors: { amount: 'Enter either an amount or a percentage' },
    })
    await expect(billing.addAdjustment('BK-0013', { kind: 'EXTRA', description: 'X', amount: 0, gstPercent: 18 })).rejects.toMatchObject({
      fieldErrors: { description: 'Describe the charge', amount: 'The amount must be more than ₹0' },
    })
  })

  it('locks final invoices', async () => {
    await expect(billing.addAdjustment('BK-0001', { kind: 'EXTRA', description: 'Minibar', amount: 300, gstPercent: 18 })).rejects.toMatchObject({
      status: 409,
      message: "INV-0001 is final. Charges can't be changed after check-out.",
    })
  })
})

describe('payments and refunds', () => {
  it('records part-payments through the mock gateway, never beyond the balance', async () => {
    await expect(billing.recordPayment('BK-0013', { amount: 20000, method: 'UPI' })).rejects.toMatchObject({
      fieldErrors: { amount: 'At most ₹14,007.00 (the balance due)' },
    })
    const payment = await billing.recordPayment('BK-0013', { amount: 5000, method: 'DEBIT_CARD' })
    expect(payment).toMatchObject({ amount: 5000, status: 'COMPLETED', transactionReference: expect.stringMatching(/^MOCK-TXN-\d{6}$/) })
    expect((await billing.invoice('BK-0013')).balance).toBe(9007)
    await expect(billing.recordPayment('BK-0001', { amount: 1, method: 'CASH' })).rejects.toMatchObject({ status: 409 })
  })

  it('refunds a cancelled booking’s deposit as a negative payment', async () => {
    await reservations.cancel('BK-0028') // 5,500 prepaid
    const before = await billing.summary()
    expect((await billing.invoice('BK-0028'))).toMatchObject({ state: 'VOID', balance: -5500, balanceState: 'CREDIT' })

    const refund = await billing.refund('BK-0028', { method: 'CREDIT_CARD' })
    expect(refund).toMatchObject({ amount: -5500, status: 'COMPLETED', transactionReference: expect.stringMatching(/^MOCK-RFD-\d{6}$/) })
    expect((await billing.invoice('BK-0028')).balanceState).toBe('SETTLED')
    const after = await billing.summary()
    expect(after.creditTotal).toBe(before.creditTotal - 5500)
    await expect(billing.refund('BK-0028', { method: 'CASH' })).rejects.toMatchObject({ status: 409, message: 'INV-0028 has no credit to refund.' })
  })

  it('summarises outstanding, credit, collected and pending amounts', async () => {
    const summary = await billing.summary()
    expect(summary).toMatchObject({ pendingCount: 1, pendingTotal: 25000 })
    expect(summary.outstandingCount).toBeGreaterThan(0)
    expect(summary.collectedThisMonth).toBeGreaterThan(0)
  })

  it('confirms or fails pending payments only', async () => {
    const confirmed = await billing.updatePaymentStatus('PAY-0024', 'COMPLETED')
    expect(confirmed.status).toBe('COMPLETED')
    expect((await billing.invoice('BK-0034')).paid).toBe(25000)
    await expect(billing.updatePaymentStatus('PAY-0024', 'FAILED')).rejects.toMatchObject({ status: 409 })
    await expect(billing.updatePaymentStatus('PAY-9999', 'FAILED')).rejects.toMatchObject({ status: 404 })
  })

  it('lists payment history with filters', async () => {
    const page = await billing.payments({ size: 50 })
    expect(page.totalElements).toBe(payments().length)
    const dates = page.content.map((p) => p.paymentDate)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect((await billing.payments({ status: 'FAILED' })).content.map((p) => p.id)).toEqual(['PAY-0017'])
    expect((await billing.payments({ search: 'MOCK-TXN-882712' })).content[0]).toMatchObject({ invoiceNumber: 'INV-0034', method: 'BANK_TRANSFER' })
    expect((await billing.payments({ method: 'CASH', size: 50 })).content.every((p) => p.method === 'CASH')).toBe(true)
  })
})

describe('stored demo data from before billing', () => {
  it('gains an empty adjustments list instead of being re-seeded', () => {
    const db = getDatabase()
    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    delete snapshot.db.billAdjustments
    snapshot.db.guests[0].phone = '+91 99999 00000' // a user change that must survive
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    const reloaded = reloadDatabaseFromStorage()
    expect(reloaded.billAdjustments).toEqual([])
    expect(reloaded.guests[0]!.phone).toBe('+91 99999 00000')
    expect(reloaded.guests).toHaveLength(db.guests.length)
  })
})
