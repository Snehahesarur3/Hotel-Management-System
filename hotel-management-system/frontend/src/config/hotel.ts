/**
 * The hotel's time zone. Business dates ("today's arrivals", "due out today", the earliest check-in date)
 * follow the hotel's calendar, not the browser's, so staff working remotely or around midnight see the same
 * day as the backend. Must match the backend's app.timezone (default Asia/Kolkata).
 */
export const DEFAULT_HOTEL_TIME_ZONE = 'Asia/Kolkata'

export function resolveTimeZone(value: string | undefined): string {
  const zone = value?.trim() || DEFAULT_HOTEL_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone
  } catch {
    console.warn(`[config] Unknown VITE_HOTEL_TIMEZONE "${zone}", using ${DEFAULT_HOTEL_TIME_ZONE}`)
    return DEFAULT_HOTEL_TIME_ZONE
  }
}

export const HOTEL_TIME_ZONE = resolveTimeZone(import.meta.env.VITE_HOTEL_TIMEZONE)
