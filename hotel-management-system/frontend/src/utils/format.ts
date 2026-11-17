import type { ISODate, ISODateTime } from '@/types/domain'

const LOCALE = 'en-IN'

const currency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const currencyWhole = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat(LOCALE)

/** ₹1,23,456.50 */
export function formatCurrency(amount: number, { whole = false } = {}): string {
  return (whole ? currencyWhole : currency).format(amount)
}

/**
 * Axis ticks in one unit (thousands) so a scale never mixes K and L: ₹0, ₹30K, ₹120K.
 * Values below 1,000 are shown in full.
 */
export function formatCurrencyAxis(amount: number): string {
  if (Math.abs(amount) < 1000) return `₹${integer.format(amount)}`
  return `₹${integer.format(Math.round((amount / 1000) * 10) / 10)}K`
}

/** ₹1.2L / ₹45K style for tight spaces (not axes - see formatCurrencyAxis). */
export function formatCurrencyCompact(amount: number): string {
  return `₹${compact.format(amount)}`
}

export function formatNumber(value: number): string {
  return integer.format(value)
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`
}

/** Parses yyyy-MM-dd[THH:mm:ss] as local time (not UTC). */
function parseLocal(iso: string): Date {
  const [datePart = '', timePart = '00:00:00'] = iso.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0)
}

/** 11 Nov 2026 */
export function formatDate(iso: ISODate | ISODateTime): string {
  return parseLocal(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** 11 Nov */
export function formatShortDate(iso: ISODate): string {
  return parseLocal(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

/** Wed */
export function formatWeekday(iso: ISODate): string {
  return parseLocal(iso).toLocaleDateString(LOCALE, { weekday: 'short' })
}

/** Nov 2026 / Nov */
export function formatMonth(monthKey: string, { withYear = false } = {}): string {
  return parseLocal(`${monthKey}-01`).toLocaleDateString(LOCALE, withYear ? { month: 'short', year: 'numeric' } : { month: 'short' })
}

/** 11 Nov 2026, 2:30 pm */
export function formatDateTime(iso: ISODateTime): string {
  return parseLocal(iso).toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Wednesday, 11 November 2026 */
export function formatLongDate(iso: ISODate): string {
  return parseLocal(iso).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const SPECIAL_LABELS: Record<string, string> = {
  BOOKING_COM: 'Booking.com',
  NATIONAL_ID: 'National ID',
  VOTER_ID: 'Voter ID',
  UPI: 'UPI',
  WALK_IN: 'Walk-in',
}

/** CHECKED_IN -> "Checked In" */
export function enumLabel(value: string): string {
  return (
    SPECIAL_LABELS[value] ??
    value
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}
