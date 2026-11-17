import { z } from 'zod'
import { unlessFailed } from './refine'
import { ROOM_STATUSES, ROOM_TYPES, type RoomStatus, type RoomType } from '@/types/enums'

/** Amenities offered in the room form (free-text values are also accepted by the API). */
export const ROOM_AMENITIES = [
  'Wi-Fi',
  'Air Conditioning',
  'Smart TV',
  'Work Desk',
  'Mini Bar',
  'Tea & Coffee Maker',
  'Rain Shower',
  'Bathtub',
  'Balcony',
  'Lounge Access',
  'Living Area',
  'Dining Area',
  'Jacuzzi',
  'Butler Service',
  'Private Terrace',
] as const

/** Suggested capacity and tariff per room type (same values as the seed). */
export const ROOM_TYPE_DEFAULTS: Record<RoomType, { capacity: number; pricePerNight: number }> = {
  STANDARD: { capacity: 2, pricePerNight: 3500 },
  DELUXE: { capacity: 2, pricePerNight: 5500 },
  EXECUTIVE: { capacity: 3, pricePerNight: 8000 },
  SUITE: { capacity: 4, pricePerNight: 12500 },
  PRESIDENTIAL: { capacity: 6, pricePerNight: 25000 },
}

/** Statuses staff may set by hand. Occupied and Reserved are driven by check-in and reservations. */
export const MANUAL_ROOM_STATUSES = ['AVAILABLE', 'CLEANING', 'MAINTENANCE'] as const satisfies readonly RoomStatus[]

const requiredNumber = (label: string) =>
  z.number({ error: `${label} is required` }).refine((n) => Number.isFinite(n), `${label} is required`)

/**
 * Validation for creating/updating a room. Used by the form (React Hook Form resolver)
 * AND by the mock service, so mock mode rejects exactly what the backend will reject.
 */
export const roomInputSchema = z
  .object({
    roomNumber: z
      .string()
      .trim()
      .regex(/^\d{3,4}$/, 'Use 3–4 digits, e.g. 204'),
    floor: requiredNumber('Floor').pipe(z.number().int('Floor must be a whole number').min(1, 'Floor must be 1 or higher').max(99, 'Floor must be 99 or lower')),
    type: z.enum(ROOM_TYPES, { error: 'Select a room type' }),
    capacity: requiredNumber('Capacity').pipe(
      z.number().int('Capacity must be a whole number').min(1, 'At least 1 guest').max(10, 'At most 10 guests'),
    ),
    pricePerNight: requiredNumber('Price').pipe(
      z
        .number()
        .min(500, 'Minimum ₹500 per night')
        .max(500000, 'Maximum ₹5,00,000 per night')
        .refine((n) => Math.round(n * 100) === n * 100, 'Use at most 2 decimal places'),
    ),
    amenities: z
      .array(z.string().trim().min(1).max(40))
      .max(20, 'At most 20 amenities')
      .transform((list) => [...new Set(list)]),
    status: z.enum(ROOM_STATUSES, { error: 'Select a status' }),
    description: z.string().trim().max(500, 'At most 500 characters'),
  })
  .superRefine((room, ctx) => {
    const floor = String(room.floor)
    // Only compare with the floor once the number itself is well-formed (avoids two messages for one mistake).
    if (/^\d{3,4}$/.test(room.roomNumber) && Number.isInteger(room.floor) && !(room.roomNumber.startsWith(floor) && room.roomNumber.length === floor.length + 2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['roomNumber'],
        message: `Room numbers on floor ${floor} look like ${floor}01–${floor}99`,
      })
    }
  }, unlessFailed('roomNumber'))

export type RoomFormValues = z.input<typeof roomInputSchema>
