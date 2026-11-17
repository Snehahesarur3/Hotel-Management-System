import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { HousekeepingStatus } from '@/types/enums'
import type { HousekeepingListQuery, HousekeepingTaskInput, HousekeepingTaskView } from '@/types/housekeeping'
import { enumLabel } from '@/utils/format'
import { useApiMutation } from './useApiMutation'
import { dashboardKeys } from './useDashboard'
import { roomKeys } from './useRooms'

export const housekeepingKeys = {
  all: ['housekeeping'] as const,
  list: (query: HousekeepingListQuery) => [...housekeepingKeys.all, 'list', query] as const,
  summary: (date: string) => [...housekeepingKeys.all, 'summary', date] as const,
}

/** Task changes can free rooms (room lists, front desk check-in readiness) and move dashboard figures. */
const AFFECTED = [housekeepingKeys.all, roomKeys.all, dashboardKeys.all, ['front-desk'], ['staff']]

export function useHousekeepingTasks(query: HousekeepingListQuery) {
  return useQuery({ queryKey: housekeepingKeys.list(query), queryFn: () => api.housekeeping.list(query), placeholderData: keepPreviousData })
}

export function useHousekeepingSummary(date: string) {
  return useQuery({ queryKey: housekeepingKeys.summary(date), queryFn: () => api.housekeeping.summary(date) })
}

interface Options {
  onDone?: (task: HousekeepingTaskView) => void
  onError?: (error: ApiError) => boolean | void
}

export function useCreateTask({ onDone, onError }: Options = {}) {
  return useApiMutation({
    mutationFn: (input: HousekeepingTaskInput) => api.housekeeping.create(input),
    successMessage: (t) => `${enumLabel(t.taskType)} for Room ${t.roomNumber} assigned to ${t.assignee}`,
    invalidate: AFFECTED,
    onSuccess: (t) => onDone?.(t),
    onError,
  })
}

export function useUpdateTask({ onDone, onError }: Options = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: HousekeepingTaskInput }) => api.housekeeping.update(id, input),
    successMessage: (t) => `${t.id} updated`,
    invalidate: AFFECTED,
    onSuccess: (t) => onDone?.(t),
    onError,
  })
}

const STATUS_MESSAGE: Record<HousekeepingStatus, string> = {
  PENDING: 'paused',
  IN_PROGRESS: 'started',
  COMPLETED: 'completed',
}

export function useUpdateTaskStatus() {
  return useApiMutation({
    mutationFn: ({ id, status }: { id: string; status: HousekeepingStatus }) => api.housekeeping.updateStatus(id, status),
    successMessage: (t) =>
      `Room ${t.roomNumber} ${enumLabel(t.taskType).toLowerCase()} ${STATUS_MESSAGE[t.status]}` +
      (t.status === 'COMPLETED' && (t.roomStatus === 'AVAILABLE' || t.roomStatus === 'RESERVED') && t.taskType !== 'DAILY_SERVICE' && t.taskType !== 'INSPECTION'
        ? ` · room is now ${enumLabel(t.roomStatus).toLowerCase()}`
        : ''),
    invalidate: AFFECTED,
  })
}

export function useDeleteTask({ onDone }: { onDone?: () => void } = {}) {
  return useApiMutation({
    mutationFn: async (task: HousekeepingTaskView) => {
      await api.housekeeping.remove(task.id)
      return task
    },
    successMessage: (t) => `${t.id} deleted`,
    invalidate: AFFECTED,
    onSuccess: () => onDone?.(),
  })
}
