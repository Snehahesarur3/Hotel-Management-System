import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ReportRange, RevenueReportQuery } from '@/types/reports'

export const reportKeys = {
  all: ['reports'] as const,
  revenue: (query: RevenueReportQuery) => [...reportKeys.all, 'revenue', query] as const,
  occupancy: (range: ReportRange) => [...reportKeys.all, 'occupancy', range] as const,
  reservations: (range: ReportRange) => [...reportKeys.all, 'reservations', range] as const,
  guests: (range: ReportRange) => [...reportKeys.all, 'guests', range] as const,
  payments: (range: ReportRange) => [...reportKeys.all, 'payments', range] as const,
}

/**
 * Reports aggregate every module, so instead of being invalidated by each mutation they are
 * always treated as stale: opening a report refetches it (the previous figures stay on screen meanwhile).
 */
const REPORT_OPTIONS = { staleTime: 0, placeholderData: keepPreviousData } as const

export function useRevenueReport(query: RevenueReportQuery) {
  return useQuery({ queryKey: reportKeys.revenue(query), queryFn: () => api.reports.revenue(query), ...REPORT_OPTIONS })
}

export function useOccupancyReport(range: ReportRange) {
  return useQuery({ queryKey: reportKeys.occupancy(range), queryFn: () => api.reports.occupancy(range), ...REPORT_OPTIONS })
}

export function useReservationReport(range: ReportRange) {
  return useQuery({ queryKey: reportKeys.reservations(range), queryFn: () => api.reports.reservations(range), ...REPORT_OPTIONS })
}

export function useGuestReport(range: ReportRange) {
  return useQuery({ queryKey: reportKeys.guests(range), queryFn: () => api.reports.guests(range), ...REPORT_OPTIONS })
}

export function usePaymentReport(range: ReportRange) {
  return useQuery({ queryKey: reportKeys.payments(range), queryFn: () => api.reports.payments(range), ...REPORT_OPTIONS })
}
