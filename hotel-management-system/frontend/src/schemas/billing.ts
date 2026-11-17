import { z } from 'zod'
import { unlessFailed } from './refine'
import { EXTRA_GST_RATES } from '@/types/billing'
import { PAYMENT_METHODS } from '@/types/enums'

const money = (label: string, max: number) =>
  z
    .number({ error: `Enter the ${label}` })
    .refine((n) => Number.isFinite(n), `Enter the ${label}`)
    .pipe(
      z
        .number()
        .positive(`The ${label} must be more than ₹0`)
        .max(max, `The ${label} can be at most ₹${max.toLocaleString('en-IN')}`)
        .refine((n) => Math.round(n * 100) === n * 100, 'Use at most 2 decimal places'),
    )

const description = z.string().trim().min(2, 'Describe the charge').max(80, 'At most 80 characters')

/** Extra charge or discount posted to a folio. Shared by the forms and the mock service. */
export const adjustmentInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('EXTRA'),
    description,
    amount: money('amount', 100000),
    gstPercent: z.union(EXTRA_GST_RATES.map((r) => z.literal(r)) as [z.ZodLiteral<0>, z.ZodLiteral<5>, z.ZodLiteral<12>, z.ZodLiteral<18>], {
      error: 'Choose a GST rate',
    }),
  }),
  z
    .object({
      kind: z.literal('DISCOUNT'),
      description: z.string().trim().min(2, 'Give a reason for the discount').max(80, 'At most 80 characters'),
      amount: money('discount', 500000).optional(),
      percent: z
        .number({ error: 'Enter the percentage' })
        .refine((n) => Number.isFinite(n), 'Enter the percentage')
        .pipe(z.number().min(1, 'At least 1%').max(100, 'At most 100%').refine((n) => Math.round(n * 10) === n * 10, 'Use at most 1 decimal place'))
        .optional(),
    })
    .superRefine((d, ctx) => {
      if ((d.amount === undefined) === (d.percent === undefined)) {
        ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter either an amount or a percentage' })
      }
    }, unlessFailed('amount', 'percent')),
])

export const paymentInputSchema = z.object({
  amount: money('amount', 10000000),
  method: z.enum(PAYMENT_METHODS, { error: 'Choose a payment method' }),
})

export const refundInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS, { error: 'Choose how the refund is paid' }),
})
