import type { ServiceProvider } from '@/api/types'
import {
  calculateDashboardSummary,
  calculateOccupancySeries,
  calculateRevenueSeries,
} from '@/mock/calculations/dashboard'
import { getDatabase } from '@/mock/db'
import { mockCall } from '@/mock/latency'
import { todayISO } from '@/utils/date'
import { mockAuthService } from './auth'
import { mockBillingService } from './billing'
import { mockFrontDeskService } from './frontDesk'
import { mockGuestService } from './guests'
import { mockHousekeepingService } from './housekeeping'
import { mockInventoryService } from './inventory'
import { mockReportService } from './reports'
import { mockReservationService } from './reservations'
import { mockRestaurantService } from './restaurant'
import { mockRoomService } from './rooms'
import { mockSettingsService } from './settings'
import { mockStaffService } from './staff'

/** In-browser mock implementation of the service contract. */
export const mockServices: ServiceProvider = {
  system: {
    health: () =>
      mockCall(() => ({
        status: 'UP' as const,
        dataMode: 'browser-mock',
        timestamp: new Date().toISOString(),
      })),
  },
  auth: mockAuthService,
  dashboard: {
    summary: () => mockCall(() => calculateDashboardSummary(getDatabase(), todayISO())),
    revenue: () => mockCall(() => calculateRevenueSeries(getDatabase(), todayISO())),
    occupancy: () => mockCall(() => calculateOccupancySeries(getDatabase(), todayISO())),
  },
  rooms: mockRoomService,
  guests: mockGuestService,
  reservations: mockReservationService,
  frontDesk: mockFrontDeskService,
  billing: mockBillingService,
  housekeeping: mockHousekeepingService,
  restaurant: mockRestaurantService,
  staff: mockStaffService,
  inventory: mockInventoryService,
  reports: mockReportService,
  settings: mockSettingsService,
}
