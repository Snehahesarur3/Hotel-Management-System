import type { PaymentMethod } from '@/types/enums'

/**
 * ============================================================================
 *  MOCK PAYMENT PROCESSING - NOT A REAL PAYMENT GATEWAY
 * ============================================================================
 * This module stands in for a payment provider (card acquirer, UPI PSP, bank).
 * It never sees, stores or transmits card numbers, UPI IDs or bank details:
 * the front desk only chooses a payment *method*, and this mock approves it and
 * returns a fake transaction reference ("MOCK-TXN-…", or "CASH-…" for cash).
 *
 * Real integration belongs behind the same `PaymentGateway` contract on the
 * backend (a `PaymentGateway` interface with a `MockPaymentGateway` bean in
 * Phase 12). A real provider would replace that bean server-side - card data
 * must never be handled by this frontend or by the mock services.
 * ============================================================================
 */

export interface PaymentRequest {
  amount: number
  method: PaymentMethod
  /** What is being paid, e.g. the reservation id (sent as the provider's order reference). */
  reference: string
}

export type PaymentResult =
  | { approved: true; transactionReference: string }
  | { approved: false; declineReason: string }

export interface PaymentGateway {
  charge(request: PaymentRequest): PaymentResult
  /** Returns money to the guest (amount is positive here; it is stored as a negative payment). */
  refund(request: PaymentRequest): PaymentResult
}

function randomDigits(count: number): string {
  const values = crypto.getRandomValues(new Uint32Array(count))
  return Array.from(values, (v) => String(v % 10)).join('')
}

/** Approves every positive amount. Deterministic decline rules can be added here to demo failures. */
export const mockPaymentGateway: PaymentGateway = {
  charge({ amount, method }) {
    if (!(amount > 0)) return { approved: false, declineReason: 'Amount must be greater than zero' }
    const prefix = method === 'CASH' ? 'CASH' : 'MOCK-TXN'
    return { approved: true, transactionReference: `${prefix}-${randomDigits(6)}` }
  },
  refund({ amount, method }) {
    if (!(amount > 0)) return { approved: false, declineReason: 'Refund amount must be greater than zero' }
    const prefix = method === 'CASH' ? 'CASH-RFD' : 'MOCK-RFD'
    return { approved: true, transactionReference: `${prefix}-${randomDigits(6)}` }
  },
}
