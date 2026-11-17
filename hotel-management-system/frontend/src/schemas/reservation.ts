import { z } from 'zod'
import { unlessFailed } from './refine'
import { BOOKING_SOURCES } from '@/types/enums'
import { BOOKABLE_STATUSES } from '@/types/reservation'
import { diffDays } from '@/utils/date'
import { formatDate } from '@/utils/format'

/** Longest stay a single booking may cover. */
export const MAX_NIGHTS = 30
/** Largest party size of any room type (Presidential suites take 6; the schema allows headroom). */
export const MAX_GUESTS = 10

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isoDate = (required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .regex(ISO_DATE, 'Use the format yyyy-mm-dd')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')

/**
 * Reservation validation shared by the form and the mock service.
 * `earliestCheckIn`: today when creating; when editing, the booking's stored check-in if that is
 * earlier (a confirmed guest arriving late keeps their dates), otherwise today.
 */
export function reservationInputSchema({ earliestCheckIn }: { earliestCheckIn: string }) {
  return z
    .object({
      guestId: z.string().trim().min(1, 'Select a guest'),
      roomId: z.string().trim().min(1, 'Select an available room'),
      checkIn: isoDate('Select the check-in date'),
      checkOut: isoDate('Select the check-out date'),
      numberOfGuests: z
        .number({ error: 'Enter the number of guests' })
        .refine((n) => Number.isFinite(n), 'Enter the number of guests')
        .pipe(z.number().int('Use a whole number').min(1, 'At least 1 guest').max(MAX_GUESTS, `At most ${MAX_GUESTS} guests`)),
      source: z.enum(BOOKING_SOURCES, { error: 'Select a booking source' }),
      status: z.enum(BOOKABLE_STATUSES, { error: 'Select Pending or Confirmed' }),
    })
    .superRefine((r, ctx) => {
      if (!ISO_DATE.test(r.checkIn) || !ISO_DATE.test(r.checkOut)) return
      if (r.checkIn < earliestCheckIn) {
        ctx.addIssue({ code: 'custom', path: ['checkIn'], message: `Check-in cannot be before ${formatDate(earliestCheckIn)}` })
      }
      const nights = diffDays(r.checkIn, r.checkOut)
      if (nights < 1) {
        ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'Check-out must be after check-in' })
      } else if (nights > MAX_NIGHTS) {
        ctx.addIssue({ code: 'custom', path: ['checkOut'], message: `A booking can cover at most ${MAX_NIGHTS} nights` })
      }
    }, unlessFailed('checkIn', 'checkOut'))
}

export type ReservationFormValues = z.input<ReturnType<typeof reservationInputSchema>>
