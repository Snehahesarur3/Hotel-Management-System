import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { BillAdjustmentInput, Invoice, InvoiceListQuery, PaymentInput, PaymentListQuery, RefundInput } from '@/types/billing'
import type { Payment } from '@/types/domain'
import type { PaymentStatus } from '@/types/enums'
import { formatCurrency } from '@/utils/format'
import { useApiMutation } from './useApiMutation'
import { dashboardKeys } from './useDashboard'
import { guestKeys } from './useGuests'
import { reservationKeys } from './useReservations'

export const billingKeys = {
  all: ['billing'] as const,
  summary: () => [...billingKeys.all, 'summary'] as const,
  invoices: (query: InvoiceListQuery) => [...billingKeys.all, 'invoices', query] as const,
  invoice: (id: string) => [...billingKeys.all, 'invoice', id] as const,
  payments: (query: PaymentListQuery) => [...billingKeys.all, 'payments', query] as const,
}

/** Money movements change invoices, booking details, guest spend, dashboard revenue and check-out bills. */
const AFFECTED = [billingKeys.all, reservationKeys.all, guestKeys.all, dashboardKeys.all, ['front-desk']]

export function useBillingSummary() {
  return useQuery({ queryKey: billingKeys.summary(), queryFn: () => api.billing.summary() })
}

export function useInvoiceList(query: InvoiceListQuery) {
  return useQuery({ queryKey: billingKeys.invoices(query), queryFn: () => api.billing.invoices(query), placeholderData: keepPreviousData })
}

export function useInvoice(reservationId: string) {
  return useQuery({ queryKey: billingKeys.invoice(reservationId), queryFn: () => api.billing.invoice(reservationId) })
}

export function usePaymentList(query: PaymentListQuery) {
  return useQuery({ queryKey: billingKeys.payments(query), queryFn: () => api.billing.payments(query), placeholderData: keepPreviousData })
}

interface Options<T> {
  onDone?: (result: T) => void
  onError?: (error: ApiError) => boolean | void
}

export function useAddAdjustment({ onDone, onError }: Options<Invoice> = {}) {
  return useApiMutation({
    mutationFn: ({ reservationId, input }: { reservationId: string; input: BillAdjustmentInput }) => api.billing.addAdjustment(reservationId, input),
    successMessage: (_invoice, { input }) => `${input.kind === 'EXTRA' ? 'Charge' : 'Discount'} added: ${input.description}`,
    invalidate: AFFECTED,
    onSuccess: (invoice) => onDone?.(invoice),
    onError,
  })
}

export function useRemoveAdjustment() {
  return useApiMutation({
    mutationFn: ({ reservationId, adjustmentId }: { reservationId: string; adjustmentId: string; description: string }) =>
      api.billing.removeAdjustment(reservationId, adjustmentId),
    successMessage: (_invoice, { description }) => `Removed: ${description}`,
    invalidate: AFFECTED,
  })
}

export function useRecordPayment({ onDone, onError }: Options<Payment> = {}) {
  return useApiMutation({
    mutationFn: ({ reservationId, input }: { reservationId: string; input: PaymentInput }) => api.billing.recordPayment(reservationId, input),
    successMessage: (p) => `${formatCurrency(p.amount)} received · ${p.transactionReference}`,
    invalidate: AFFECTED,
    onSuccess: (p) => onDone?.(p),
    onError,
  })
}

export function useRefund({ onDone, onError }: Options<Payment> = {}) {
  return useApiMutation({
    mutationFn: ({ reservationId, input }: { reservationId: string; input: RefundInput }) => api.billing.refund(reservationId, input),
    successMessage: (p) => `${formatCurrency(-p.amount)} refunded · ${p.transactionReference}`,
    invalidate: AFFECTED,
    onSuccess: (p) => onDone?.(p),
    onError,
  })
}

export function useUpdatePaymentStatus({ onDone }: { onDone?: (p: Payment) => void } = {}) {
  return useApiMutation({
    mutationFn: ({ paymentId, status }: { paymentId: string; status: PaymentStatus }) => api.billing.updatePaymentStatus(paymentId, status),
    successMessage: (p) => `${p.id} marked ${p.status === 'COMPLETED' ? 'received' : 'failed'}`,
    invalidate: AFFECTED,
    onSuccess: (p) => onDone?.(p),
  })
}
