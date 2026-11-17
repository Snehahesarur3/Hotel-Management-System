import { z } from 'zod'
import { INVENTORY_CATEGORIES } from '@/types/enums'
import { PHONE } from './guest'

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `Enter the ${label}` })
    .refine((n) => Number.isFinite(n), `Enter the ${label}`)
    .pipe(z.number().int(`The ${label} must be a whole number`).min(min, `The ${label} must be at least ${min}`).max(max, `The ${label} can be at most ${max.toLocaleString('en-IN')}`))

const unitCost = z
  .number({ error: 'Enter the unit cost' })
  .refine((n) => Number.isFinite(n), 'Enter the unit cost')
  .pipe(
    z
      .number()
      .positive('The unit cost must be more than ₹0')
      .max(1000000, 'The unit cost can be at most ₹10,00,000')
      .refine((n) => Math.round(n * 100) === n * 100, 'Use at most 2 decimal places'),
  )

/** Inventory item validation shared by the form and the mock service. */
export const inventoryItemSchema = z.object({
  name: z.string().trim().min(2, 'Enter the item name').max(60, 'At most 60 characters'),
  category: z.enum(INVENTORY_CATEGORIES, { error: 'Choose a category' }),
  unit: z.string().trim().min(1, 'Enter the unit, e.g. pcs').max(20, 'At most 20 characters'),
  quantity: wholeNumber('opening stock', 0, 1000000),
  minStockLevel: wholeNumber('reorder level', 0, 1000000),
  unitCost,
  supplier: z.object({
    name: z.string().trim().min(2, 'Enter the supplier').max(80, 'At most 80 characters'),
    contactPerson: z.string().trim().min(2, 'Enter the contact person').max(80, 'At most 80 characters'),
    phone: z.string().trim().regex(PHONE, 'Enter a valid phone number'),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  }),
})

export type InventoryItemFormValues = z.input<typeof inventoryItemSchema>

const reason = z.string().trim().min(3, 'Give a reason').max(100, 'At most 100 characters')

export const stockInSchema = z.object({
  quantity: wholeNumber('quantity', 1, 1000000),
  reason,
  unitCost: unitCost.optional(),
})

export const stockOutSchema = z.object({
  quantity: wholeNumber('quantity', 1, 1000000),
  reason,
})
