import type { GstSlab, ISODate } from '@/types/domain'
import type { StayQuote } from '@/types/reservation'
import { diffDays } from './date'
import { percentOf, roundMoney } from './money'

/**
 * GST percentage for a nightly rate: the first slab whose upper bound covers the rate
 * (Indian hotel GST is slabbed on the per-night tariff, not on the bill total).
 */
export function roomGstPercent(rate: number, slabs: readonly GstSlab[]): number {
  const slab = slabs.find((s) => s.maxRate === null || rate <= s.maxRate)
  return slab?.percent ?? 0
}

/** Room charges and GST for a stay at a fixed nightly rate. Same rules as the backend PricingService. */
export function quoteStay(rate: number, checkIn: ISODate, checkOut: ISODate, slabs: readonly GstSlab[]): StayQuote {
  const nights = Math.max(0, diffDays(checkIn, checkOut))
  const roomCharges = roundMoney(rate * nights)
  const gstPercent = roomGstPercent(rate, slabs)
  const gstAmount = percentOf(roomCharges, gstPercent)
  return { nights, roomRate: rate, roomCharges, gstPercent, gstAmount, total: roundMoney(roomCharges + gstAmount) }
}
