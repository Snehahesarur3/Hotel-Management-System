import { z } from 'zod'
import { PAYMENT_METHODS } from '@/types/enums'

/** Check-in form and mock-service validation. */
export const checkInSchema = z.object({
  roomId: z.string().trim().min(1, 'Choose the room to assign'),
  idLast4: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{4}$/, 'Enter the last 4 letters or digits from the ID document')),
})

export type CheckInFormValues = z.input<typeof checkInSchema>

/** Check-out request. Whether a payment method is required depends on the balance (checked by the API). */
export const checkOutSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS, { error: 'Choose how the guest is paying' }).optional(),
})
