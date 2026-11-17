import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  revenue: () => [...dashboardKeys.all, 'revenue'] as const,
  occupancy: () => [...dashboardKeys.all, 'occupancy'] as const,
}

export function useDashboardSummary() {
  return useQuery({ queryKey: dashboardKeys.summary(), queryFn: () => api.dashboard.summary() })
}

export function useRevenueSeries() {
  return useQuery({ queryKey: dashboardKeys.revenue(), queryFn: () => api.dashboard.revenue() })
}

export function useOccupancySeries() {
  return useQuery({ queryKey: dashboardKeys.occupancy(), queryFn: () => api.dashboard.occupancy() })
}
