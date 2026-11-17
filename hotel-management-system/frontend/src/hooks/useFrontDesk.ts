import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { ReservationSummary } from '@/types/dashboard'
import type { CheckInInput, CheckOutInput, CheckOutResult } from '@/types/frontDesk'
import { formatCurrency } from '@/utils/format'
import { useApiMutation } from './useApiMutation'
import { dashboardKeys } from './useDashboard'
import { guestKeys } from './useGuests'
import { reservationKeys } from './useReservations'
import { roomKeys } from './useRooms'

export const frontDeskKeys = {
  all: ['front-desk'] as const,
  overview: () => [...frontDeskKeys.all, 'overview'] as const,
  checkIn: (id: string) => [...frontDeskKeys.all, 'check-in', id] as const,
  checkOut: (id: string) => [...frontDeskKeys.all, 'check-out', id] as const,
}

/** Check-in/out changes bookings, room status, guest stats, payments and housekeeping (dashboard). */
const AFFECTED = [frontDeskKeys.all, reservationKeys.all, roomKeys.all, guestKeys.all, dashboardKeys.all, ['billing'], ['housekeeping'], ['restaurant'], ['staff']]

export function useFrontDeskOverview() {
  return useQuery({ queryKey: frontDeskKeys.overview(), queryFn: () => api.frontDesk.overview() })
}

/** Rooms and ID type for the check-in dialog; always fresh because room readiness changes constantly. */
export function useCheckInPreview(reservationId: string | null) {
  return useQuery({
    queryKey: frontDeskKeys.checkIn(reservationId ?? ''),
    queryFn: () => api.frontDesk.checkInPreview(reservationId!),
    enabled: reservationId !== null,
    staleTime: 0,
  })
}

/** Final bill for the check-out dialog. */
export function useCheckOutPreview(reservationId: string | null) {
  return useQuery({
    queryKey: frontDeskKeys.checkOut(reservationId ?? ''),
    queryFn: () => api.frontDesk.checkOutPreview(reservationId!),
    enabled: reservationId !== null,
    staleTime: 0,
  })
}

interface MutationOptions<T> {
  onDone?: (result: T) => void
  onError?: (error: ApiError) => boolean | void
}

export function useCheckIn({ onDone, onError }: MutationOptions<ReservationSummary> = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: CheckInInput }) => api.frontDesk.checkIn(id, input),
    successMessage: (r) => `${r.guestName} checked in to Room ${r.roomNumber}`,
    invalidate: AFFECTED,
    onSuccess: (r) => onDone?.(r),
    onError,
  })
}

export function useCheckOut({ onDone, onError }: MutationOptions<CheckOutResult> = {}) {
  return useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: CheckOutInput }) => api.frontDesk.checkOut(id, input),
    successMessage: ({ reservation, payment }) =>
      `${reservation.guestName} checked out${payment ? ` · ${formatCurrency(payment.amount)} collected` : ''}. Room ${reservation.roomNumber} sent for cleaning.`,
    invalidate: AFFECTED,
    onSuccess: (result) => onDone?.(result),
    onError,
  })
}
