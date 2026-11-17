import type { ReportService } from '@/api/types'
import {
  calculateGuestReport,
  calculateOccupancyReport,
  calculatePaymentReport,
  calculateReservationReport,
  calculateRevenueReport,
} from '@/mock/calculations/reports'
import { getDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import { parseOrThrow } from '@/mock/validation'
import { reportRangeSchema, revenueReportQuerySchema } from '@/schemas/reports'
import { todayISO } from '@/utils/date'

/**
 * Mock implementation of /api/reports/*. Read-only: every figure is calculated from the
 * current mock database on each call (see mock/calculations/reports.ts for the rules).
 * Ranges are validated with the same schema as the filter form (400 with field errors otherwise).
 */
export const mockReportService: ReportService = {
  revenue: (query) => mockCall(() => calculateRevenueReport(getDatabase(), parseOrThrow(revenueReportQuerySchema, query))),
  occupancy: (range) => mockCall(() => calculateOccupancyReport(getDatabase(), parseOrThrow(reportRangeSchema, range), todayISO())),
  reservations: (range) => mockCall(() => calculateReservationReport(getDatabase(), parseOrThrow(reportRangeSchema, range))),
  guests: (range) => mockCall(() => calculateGuestReport(getDatabase(), parseOrThrow(reportRangeSchema, range))),
  payments: (range) => mockCall(() => calculatePaymentReport(getDatabase(), parseOrThrow(reportRangeSchema, range))),
}
