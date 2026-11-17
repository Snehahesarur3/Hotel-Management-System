import { describe, expect, it } from 'vitest'
import { roomInputSchema, type RoomFormValues } from './room'

const valid: RoomFormValues = {
  roomNumber: '204',
  floor: 2,
  type: 'DELUXE',
  capacity: 2,
  pricePerNight: 5500,
  amenities: ['Wi-Fi', 'Mini Bar', 'Wi-Fi'],
  status: 'AVAILABLE',
  description: '  Partial sea view ',
}

const errorsOf = (values: Partial<RoomFormValues>) => {
  const result = roomInputSchema.safeParse({ ...valid, ...values })
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('roomInputSchema', () => {
  it('accepts a valid room, trimming text and removing duplicate amenities', () => {
    const parsed = roomInputSchema.parse(valid)
    expect(parsed.amenities).toEqual(['Wi-Fi', 'Mini Bar'])
    expect(parsed.description).toBe('Partial sea view')
  })

  it('requires the room number to start with the floor', () => {
    expect(errorsOf({ roomNumber: '305' })).toEqual({ roomNumber: 'Room numbers on floor 2 look like 201–299' })
    expect(errorsOf({ roomNumber: '1204', floor: 12 })).toEqual({})
    expect(errorsOf({ roomNumber: '20' })).toHaveProperty('roomNumber', 'Use 3–4 digits, e.g. 204')
  })

  it('reports empty number inputs (NaN) as required', () => {
    expect(errorsOf({ floor: Number.NaN })).toHaveProperty('floor', 'Floor is required')
    expect(errorsOf({ capacity: Number.NaN })).toHaveProperty('capacity', 'Capacity is required')
    expect(errorsOf({ pricePerNight: Number.NaN })).toHaveProperty('pricePerNight', 'Price is required')
  })

  it('enforces sensible ranges', () => {
    expect(errorsOf({ capacity: 0 })).toHaveProperty('capacity', 'At least 1 guest')
    expect(errorsOf({ capacity: 2.5 })).toHaveProperty('capacity', 'Capacity must be a whole number')
    expect(errorsOf({ pricePerNight: 100 })).toHaveProperty('pricePerNight', 'Minimum ₹500 per night')
    expect(errorsOf({ pricePerNight: 5500.555 })).toHaveProperty('pricePerNight', 'Use at most 2 decimal places')
    expect(errorsOf({ description: 'x'.repeat(501) })).toHaveProperty('description')
  })
})
