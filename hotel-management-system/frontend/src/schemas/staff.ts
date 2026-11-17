import { z } from 'zod'
import { DEPARTMENTS, EMPLOYMENT_STATUSES } from '@/types/enums'
import { addDays } from '@/utils/date'
import { formatDate } from '@/utils/format'
import { NAME, PHONE } from './guest'

/** New hires can be entered up to this many days before they join. */
export const MAX_DAYS_BEFORE_JOINING = 90

/** Staff validation shared by the form and the mock service. */
export function staffInputSchema({ today }: { today: string }) {
  const latest = addDays(today, MAX_DAYS_BEFORE_JOINING)
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Enter the full name')
      .max(80, 'At most 80 characters')
      .regex(NAME, 'Use letters, spaces, apostrophes, dots or hyphens'),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(120)),
    phone: z
      .string()
      .trim()
      .regex(PHONE, 'Enter a valid phone number, e.g. +91 98450 12345')
      .refine((p) => p.replace(/\D/g, '').length >= 7, 'Enter a valid phone number, e.g. +91 98450 12345'),
    department: z.enum(DEPARTMENTS, { error: 'Choose a department' }),
    designation: z.string().trim().min(2, 'Enter the job title').max(60, 'At most 60 characters'),
    joiningDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the joining date')
      .refine((d) => d <= latest, `Joining date can be at most ${MAX_DAYS_BEFORE_JOINING} days ahead (${formatDate(latest)})`),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES, { error: 'Choose a status' }),
  })
}

export type StaffFormValues = z.input<ReturnType<typeof staffInputSchema>>
