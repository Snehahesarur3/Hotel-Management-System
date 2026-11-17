import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { GuestInput, GuestListQuery, GuestSummary } from '@/types/guest'
import { dashboardKeys } from './useDashboard'
import { roomKeys } from './useRooms'
import { useApiMutation } from './useApiMutation'

export const guestKeys = {
  all: ['guests'] as const,
  list: (query: GuestListQuery) => [...guestKeys.all, 'list', query] as const,
  detail: (id: string) => [...guestKeys.all, 'detail', id] as const,
  history: (id: string) => [...guestKeys.all, 'history', id] as const,
  nationalities: () => [...guestKeys.all, 'nationalities'] as const,
}

/** Guest names appear in room activity and dashboard lists, so refresh those too. */
const AFFECTED = [guestKeys.all, roomKeys.all, dashboardKeys.all]

export function useGuestList(query: GuestListQuery) {
  return useQuery({ queryKey: guestKeys.list(query), queryFn: () => api.guests.list(query), placeholderData: keepPreviousData })
}

export function useGuest(id: string) {
  return useQuery({ queryKey: guestKeys.detail(id), queryFn: () => api.guests.get(id) })
}

export function useGuestHistory(id: string) {
  return useQuery({ queryKey: guestKeys.history(id), queryFn: () => api.guests.history(id) })
}

export function useGuestNationalities() {
  return useQuery({ queryKey: guestKeys.nationalities(), queryFn: () => api.guests.nationalities() })
}

interface FormMutationOptions {
  onSaved?: (guest: GuestSummary) => void
  onError?: (error: ApiError) => boolean | void
}

export function useCreateGuest({ onSaved, onError }: FormMutationOptions = {}) {
  return useApiMutation({
    mutationFn: (input: GuestInput) => api.guests.create(input),
    successMessage: (guest) => `${guest.fullName} added`,
    invalidate: AFFECTED,
    onSuccess: (guest) => onSaved?.(guest),
    onError,
  })
}

export function useUpdateGuest({ onSaved, onError }: FormMutationOptions = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: GuestInput }) => api.guests.update(id, input),
    successMessage: (guest) => `${guest.fullName} updated`,
    invalidate: AFFECTED,
    onSuccess: (guest) => onSaved?.(guest),
    onError,
  })
}

export function useDeleteGuest({ onDeleted }: { onDeleted?: (guest: GuestSummary) => void } = {}) {
  return useApiMutation({
    mutationFn: async (guest: GuestSummary) => {
      await api.guests.remove(guest.id)
      return guest
    },
    successMessage: (guest) => `${guest.fullName} deleted`,
    invalidate: AFFECTED,
    onSuccess: (guest) => onDeleted?.(guest),
  })
}
