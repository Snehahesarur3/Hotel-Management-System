import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { ReservationSummary } from '@/types/dashboard'
import type { AvailabilityQuery, ReservationInput, ReservationListQuery } from '@/types/reservation'
import { useApiMutation } from './useApiMutation'
import { dashboardKeys } from './useDashboard'
import { guestKeys } from './useGuests'
import { roomKeys } from './useRooms'

export const reservationKeys = {
  all: ['reservations'] as const,
  list: (query: ReservationListQuery) => [...reservationKeys.all, 'list', query] as const,
  detail: (id: string) => [...reservationKeys.all, 'detail', id] as const,
  availability: (query: AvailabilityQuery) => [...reservationKeys.all, 'availability', query] as const,
}

/** Bookings drive room status, room activity, guest history, the dashboard and today's front-desk lists. */
const AFFECTED = [reservationKeys.all, roomKeys.all, guestKeys.all, dashboardKeys.all, ['front-desk'], ['billing']]

export function useReservationList(query: ReservationListQuery, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reservationKeys.list(query),
    queryFn: () => api.reservations.list(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useReservation(id: string) {
  return useQuery({ queryKey: reservationKeys.detail(id), queryFn: () => api.reservations.get(id) })
}

/** Bookable rooms for the dates; disabled until the query is complete (`null`). */
export function useAvailability(query: AvailabilityQuery | null) {
  return useQuery({
    queryKey: reservationKeys.availability(query ?? { checkIn: '', checkOut: '', guests: 0 }),
    queryFn: () => api.reservations.availability(query!),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    // Availability changes whenever anyone books; never show stale results for long.
    staleTime: 0,
  })
}

interface FormMutationOptions {
  onSaved?: (reservation: ReservationSummary) => void
  onError?: (error: ApiError) => boolean | void
}

export function useCreateReservation({ onSaved, onError }: FormMutationOptions = {}) {
  return useApiMutation({
    mutationFn: (input: ReservationInput) => api.reservations.create(input),
    successMessage: (r) => `Booking ${r.id} created for ${r.guestName}`,
    invalidate: AFFECTED,
    onSuccess: (r) => onSaved?.(r),
    onError,
  })
}

export function useUpdateReservation({ onSaved, onError }: FormMutationOptions = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: ReservationInput }) => api.reservations.update(id, input),
    successMessage: (r) => `Booking ${r.id} updated`,
    invalidate: AFFECTED,
    onSuccess: (r) => onSaved?.(r),
    onError,
  })
}

export function useCancelReservation({ onCancelled }: { onCancelled?: (reservation: ReservationSummary) => void } = {}) {
  return useApiMutation({
    mutationFn: (id: string) => api.reservations.cancel(id),
    successMessage: (r) => `Booking ${r.id} cancelled`,
    invalidate: AFFECTED,
    onSuccess: (r) => onCancelled?.(r),
  })
}
