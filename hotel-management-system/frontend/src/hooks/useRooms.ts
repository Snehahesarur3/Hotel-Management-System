import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { Room } from '@/types/domain'
import type { RoomStatus } from '@/types/enums'
import type { RoomInput, RoomListQuery } from '@/types/room'
import { enumLabel } from '@/utils/format'
import { dashboardKeys } from './useDashboard'
import { useApiMutation } from './useApiMutation'

export const roomKeys = {
  all: ['rooms'] as const,
  list: (query: RoomListQuery) => [...roomKeys.all, 'list', query] as const,
  detail: (id: string) => [...roomKeys.all, 'detail', id] as const,
  activity: (id: string) => [...roomKeys.all, 'activity', id] as const,
  floors: () => [...roomKeys.all, 'floors'] as const,
}

/** Room changes affect room lists, details and dashboard figures. */
const AFFECTED = [roomKeys.all, dashboardKeys.all]

export function useRoomList(query: RoomListQuery) {
  // Keep showing the previous page while the next one loads (no flashing skeletons).
  return useQuery({ queryKey: roomKeys.list(query), queryFn: () => api.rooms.list(query), placeholderData: keepPreviousData })
}

export function useRoom(id: string) {
  return useQuery({ queryKey: roomKeys.detail(id), queryFn: () => api.rooms.get(id) })
}

export function useRoomActivity(id: string) {
  return useQuery({ queryKey: roomKeys.activity(id), queryFn: () => api.rooms.activity(id) })
}

export function useRoomFloors() {
  return useQuery({ queryKey: roomKeys.floors(), queryFn: () => api.rooms.floors(), staleTime: 5 * 60_000 })
}

interface FormMutationOptions {
  onSaved?: (room: Room) => void
  /** Receives API errors first; return true when they were shown in the form (suppresses the toast). */
  onError?: (error: ApiError) => boolean | void
}

export function useCreateRoom({ onSaved, onError }: FormMutationOptions = {}) {
  return useApiMutation({
    mutationFn: (input: RoomInput) => api.rooms.create(input),
    successMessage: (room) => `Room ${room.roomNumber} added`,
    invalidate: AFFECTED,
    onSuccess: (room) => onSaved?.(room),
    onError,
  })
}

export function useUpdateRoom({ onSaved, onError }: FormMutationOptions = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: RoomInput }) => api.rooms.update(id, input),
    successMessage: (room) => `Room ${room.roomNumber} updated`,
    invalidate: AFFECTED,
    onSuccess: (room) => onSaved?.(room),
    onError,
  })
}

export function useUpdateRoomStatus({ onSaved }: { onSaved?: (room: Room) => void } = {}) {
  return useApiMutation({
    mutationFn: ({ id, status }: { id: string; status: RoomStatus }) => api.rooms.updateStatus(id, status),
    successMessage: (room) => `Room ${room.roomNumber} is now ${enumLabel(room.status)}`,
    invalidate: AFFECTED,
    onSuccess: (room) => onSaved?.(room),
  })
}

export function useDeleteRoom({ onDeleted }: { onDeleted?: (room: Room) => void } = {}) {
  return useApiMutation({
    mutationFn: async (room: Room) => {
      await api.rooms.remove(room.id)
      return room
    },
    successMessage: (room) => `Room ${room.roomNumber} deleted`,
    invalidate: AFFECTED,
    onSuccess: (room) => onDeleted?.(room),
  })
}
