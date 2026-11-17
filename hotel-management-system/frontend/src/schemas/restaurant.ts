import { z } from 'zod'
import { MENU_CATEGORIES } from '@/types/enums'

/** Menu item validation shared by the form and the mock service. */
export const menuItemSchema = z.object({
  name: z.string().trim().min(2, 'Enter the dish name').max(60, 'At most 60 characters'),
  category: z.enum(MENU_CATEGORIES, { error: 'Choose a category' }),
  price: z
    .number({ error: 'Enter the price' })
    .refine((n) => Number.isFinite(n), 'Enter the price')
    .pipe(
      z
        .number()
        .min(10, 'Minimum ₹10')
        .max(20000, 'Maximum ₹20,000')
        .refine((n) => Math.round(n * 100) === n * 100, 'Use at most 2 decimal places'),
    ),
  isVegetarian: z.boolean({ error: 'Choose vegetarian or not' }),
  available: z.boolean({ error: 'Choose whether the dish is available' }),
})

export type MenuItemFormValues = z.input<typeof menuItemSchema>

export const MAX_ORDER_QUANTITY = 20

/** New order: an in-house stay and at least one menu item. */
export const orderInputSchema = z.object({
  reservationId: z.string().trim().min(1, 'Choose the guest or room to charge'),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z
          .number()
          .int('Use whole quantities')
          .min(1, 'At least 1')
          .max(MAX_ORDER_QUANTITY, `At most ${MAX_ORDER_QUANTITY} of one dish`),
      }),
    )
    .min(1, 'Add at least one dish')
    .max(30, 'At most 30 different dishes per order')
    .refine((items) => new Set(items.map((i) => i.menuItemId)).size === items.length, 'Each dish can appear only once'),
})
