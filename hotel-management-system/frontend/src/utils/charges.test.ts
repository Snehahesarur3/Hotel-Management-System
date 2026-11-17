import { describe, expect, it } from 'vitest'
import { quoteStay, roomGstPercent } from './charges'

const SLABS = [
  { maxRate: 7500, percent: 12 },
  { maxRate: null, percent: 18 },
]

describe('room GST', () => {
  it('picks the slab by nightly rate, inclusive of the upper bound', () => {
    expect(roomGstPercent(3500, SLABS)).toBe(12)
    expect(roomGstPercent(7500, SLABS)).toBe(12)
    expect(roomGstPercent(7500.01, SLABS)).toBe(18)
  })

  it('quotes a stay with paise-accurate rounding', () => {
    expect(quoteStay(3333.33, '2026-11-11', '2026-11-14', SLABS)).toEqual({
      nights: 3,
      roomRate: 3333.33,
      roomCharges: 9999.99,
      gstPercent: 12,
      gstAmount: 1200,
      total: 11199.99,
    })
  })
})
