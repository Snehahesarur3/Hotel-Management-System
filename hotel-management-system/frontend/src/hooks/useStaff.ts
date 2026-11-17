import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { StaffInput, StaffListQuery, StaffView } from '@/types/staff'
import { useApiMutation } from './useApiMutation'
import { dashboardKeys } from './useDashboard'

export const staffKeys = {
  all: ['staff'] as const,
  list: (query: StaffListQuery) => [...staffKeys.all, 'list', query] as const,
  summary: () => [...staffKeys.all, 'summary'] as const,
}

/** Staff names appear on housekeeping tasks and the dashboard. */
const AFFECTED = [staffKeys.all, ['housekeeping'], dashboardKeys.all]

export function useStaffList(query: StaffListQuery) {
  return useQuery({ queryKey: staffKeys.list(query), queryFn: () => api.staff.list(query), placeholderData: keepPreviousData })
}

export function useStaffSummary() {
  return useQuery({ queryKey: staffKeys.summary(), queryFn: () => api.staff.summary() })
}

interface Options {
  onDone?: (member: StaffView) => void
  onError?: (error: ApiError) => boolean | void
}

export function useSaveStaff({ onDone, onError }: Options = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id?: string; input: StaffInput }) => (id ? api.staff.update(id, input) : api.staff.create(input)),
    successMessage: (member, { id }) => `${member.fullName} ${id ? 'updated' : 'added'}`,
    invalidate: AFFECTED,
    onSuccess: (member) => onDone?.(member),
    onError,
  })
}

export function useDeleteStaff({ onDone }: { onDone?: () => void } = {}) {
  return useApiMutation({
    mutationFn: async (member: StaffView) => {
      await api.staff.remove(member.id)
      return member
    },
    successMessage: (member) => `${member.fullName} removed`,
    invalidate: AFFECTED,
    onSuccess: () => onDone?.(),
  })
}
