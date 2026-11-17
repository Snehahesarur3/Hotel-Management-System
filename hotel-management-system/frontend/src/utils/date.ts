import { HOTEL_TIME_ZONE } from '@/config/hotel'
import type { ISODate, ISODateTime } from '@/types/domain'

/**
 * Calendar date helpers. Dates are handled as yyyy-MM-dd strings (no time zone); "today" and "now"
 * follow the hotel's time zone (src/config/hotel.ts), like the backend's HotelClock.
 * Plain dates match java.time.LocalDate on the backend. Arithmetic uses UTC internally to avoid DST drift.
 */
const DAY_MS = 86_400_000
const pad2 = (n: number) => String(n).padStart(2, '0')

const formatters = new Map<string, Intl.DateTimeFormat>()

/** Wall-clock date and time of `now` in a time zone (default: the hotel's). */
export function wallClock(now: Date = new Date(), timeZone: string = HOTEL_TIME_ZONE) {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, format)
  }
  const part = (type: Intl.DateTimeFormatPartTypes) => format.formatToParts(now).find((p) => p.type === type)?.value ?? '00'
  return {
    date: `${part('year')}-${part('month')}-${part('day')}` as ISODate,
    time: `${part('hour')}:${part('minute')}:${part('second')}`,
  }
}

/** Today in the hotel's time zone (as the backend's HotelClock), not the browser's. */
export function todayISO(now: Date = new Date()): ISODate {
  return wallClock(now).date
}

function toUtcMs(iso: ISODate): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

function fromUtcMs(ms: number): ISODate {
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromUtcMs(toUtcMs(iso) + days * DAY_MS)
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)
}

/** yyyy-MM month key of a date or date-time. */
export function monthKey(iso: ISODate | ISODateTime): string {
  return iso.slice(0, 7)
}

/** The `count` month keys ending with the month of `iso`, oldest first. */
export function lastMonths(iso: ISODate, count: number): string[] {
  const [y, m] = iso.split('-').map(Number)
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 - i, 1))
    keys.push(`${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`)
  }
  return keys
}

const DATE_TOKEN = /^T([+-]\d+)(?:@(\d{2}):(\d{2}))?$/

/**
 * Resolves a seed date token against `today`:
 *   "T+3" -> today + 3 (yyyy-MM-dd); "T-2@14:30" -> today - 2 at 14:30 (yyyy-MM-ddTHH:mm:ss).
 * Returns null when the value is not a token.
 */
export function resolveDateToken(value: string, today: ISODate): string | null {
  const match = DATE_TOKEN.exec(value)
  if (!match) return null
  const date = addDays(today, Number(match[1]))
  return match[2] ? `${date}T${match[2]}:${match[3]}:00` : date
}

/** Deeply replaces every date token in a JSON value (returns a new value). */
export function resolveDateTokens<T>(value: T, today: ISODate): T {
  if (typeof value === 'string') return (resolveDateToken(value, today) ?? value) as T
  if (Array.isArray(value)) return value.map((v) => resolveDateTokens(v, today)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolveDateTokens(v, today)]),
    ) as T
  }
  return value
}

/** Current date-time in the hotel's time zone, yyyy-MM-ddTHH:mm:ss (matches java.time.LocalDateTime). */
export function nowISODateTime(now: Date = new Date()): ISODateTime {
  const { date, time } = wallClock(now)
  return `${date}T${time}`
}
