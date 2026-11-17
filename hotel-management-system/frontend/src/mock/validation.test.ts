import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError } from '@/types/api'
import { parseOrThrow, withMissingFieldsEmpty } from './validation'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the name'),
  tags: z.array(z.string()).min(1, 'Add a tag'),
  supplier: z.object({ email: z.string().pipe(z.email('Enter a valid email address')) }),
  count: z.number({ error: 'Enter the count' }),
  note: z.string().optional(),
  price: z.number().pipe(z.number().min(1)),
})

describe('mock validation', () => {
  it('treats missing text, list and nested fields as empty, leaving optional and other fields alone', () => {
    expect(withMissingFieldsEmpty(schema, {})).toEqual({ name: '', tags: [], supplier: { email: '' } })
    expect(withMissingFieldsEmpty(schema, { supplier: {} })).toEqual({ name: '', tags: [], supplier: { email: '' } })
    expect(withMissingFieldsEmpty(schema, 'not an object')).toBe('not an object')
  })

  it('reports the form messages for a body with missing fields, like the backend', () => {
    let error: ApiError | undefined
    try {
      parseOrThrow(schema, {})
    } catch (e) {
      error = e as ApiError
    }
    expect(error).toMatchObject({ status: 400, message: 'Validation failed' })
    expect(error?.fieldErrors).toEqual({
      name: 'Enter the name',
      tags: 'Add a tag',
      'supplier.email': 'Enter a valid email address',
      count: 'Enter the count',
      price: 'Invalid input: expected number, received undefined',
    })
  })
})
