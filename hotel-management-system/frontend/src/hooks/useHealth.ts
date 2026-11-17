import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'

export const healthQueryKey = ['system', 'health'] as const

export function useHealth() {
  return useQuery({ queryKey: healthQueryKey, queryFn: () => api.system.health() })
}
