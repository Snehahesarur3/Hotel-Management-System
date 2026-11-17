import { z } from 'zod'
import { PHONE } from './guest'
import { unlessFailed } from './refine'

/** 2-digit state code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z", check character. */
export const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
/** 24-hour HH:mm. */
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const PHONE_MESSAGE = 'Enter a valid phone number, e.g. +91 832 000 0100'

/** Hotel profile and check-in/check-out times; shared by the Settings form and the mock service (backend: SettingsServiceImpl). */
export const settingsInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter the hotel name').max(80, 'At most 80 characters'),
    address: z.string().trim().min(5, 'Enter the address').max(200, 'At most 200 characters'),
    phone: z
      .string()
      .trim()
      .regex(PHONE, PHONE_MESSAGE)
      .refine((p) => p.replace(/\D/g, '').length >= 7, PHONE_MESSAGE),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(120, 'Enter a valid email address')),
    gstin: z
      .string()
      .transform((v) => v.replace(/\s/g, '').toUpperCase())
      .pipe(z.string().regex(GSTIN, 'Enter the 15-character GSTIN, e.g. 30ABCDE1234F1Z5')),
    checkInTime: z.string().trim().regex(TIME, 'Use 24-hour time, e.g. 14:00'),
    checkOutTime: z.string().trim().regex(TIME, 'Use 24-hour time, e.g. 11:00'),
  })
  .superRefine((s, ctx) => {
    if (TIME.test(s.checkInTime) && TIME.test(s.checkOutTime) && s.checkOutTime >= s.checkInTime) {
      ctx.addIssue({ code: 'custom', path: ['checkOutTime'], message: 'Check-out must be earlier than check-in, to leave time to clean the room' })
    }
  }, unlessFailed('checkInTime', 'checkOutTime'))

export type SettingsFormValues = z.input<typeof settingsInputSchema>
