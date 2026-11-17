import { z } from 'zod'

export const signInSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(50, 'At most 50 characters'),
  password: z.string().min(1, 'Enter your password').max(100, 'At most 100 characters'),
})

export type SignInValues = z.infer<typeof signInSchema>
