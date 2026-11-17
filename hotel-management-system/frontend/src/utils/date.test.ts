import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_HOTEL_TIME_ZONE, resolveTimeZone } from '@/config/hotel'
import { addDays, diffDays, lastMonths, nowISODateTime, resolveDateToken, resolveDateTokens, todayISO, wallClock } from './date'

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('counts whole days between dates', () => {
    expect(diffDays('2026-11-09', '2026-11-12')).toBe(3)
    expect(diffDays('2026-11-12', '2026-11-09')).toBe(-3)
  })

  it('lists the trailing months oldest first, crossing a year', () => {
    expect(lastMonths('2026-02-15', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('seed date tokens', () => {
  const today = '2026-11-11'

  it('resolves date and date-time tokens relative to today', () => {
    expect(resolveDateToken('T+0', today)).toBe('2026-11-11')
    expect(resolveDateToken('T+3', today)).toBe('2026-11-14')
    expect(resolveDateToken('T-12', today)).toBe('2026-10-30')
    expect(resolveDateToken('T-2@14:30', today)).toBe('2026-11-09T14:30:00')
  })

  it('leaves non-token strings untouched', () => {
    expect(resolveDateToken('Tower Suite', today)).toBeNull()
    expect(resolveDateToken('T+3 days', today)).toBeNull()
  })

  it('resolves tokens deeply without mutating the input', () => {
    const input = { checkIn: 'T+1', nested: [{ at: 'T-1@08:00' }], name: 'Room T', count: 2 }
    const output = resolveDateTokens(input, today)
    expect(output).toEqual({ checkIn: '2026-11-12', nested: [{ at: '2026-11-10T08:00:00' }], name: 'Room T', count: 2 })
    expect(input.checkIn).toBe('T+1')
  })
})

describe('hotel clock', () => {
  // 20:00 UTC on 14 Nov is already 01:30 on 15 Nov in Kolkata (UTC+5:30).
  const lateEvening = new Date('2026-11-14T20:00:00Z')

  it('uses the hotel time zone for today, whatever the browser zone', () => {
    expect(todayISO(lateEvening)).toBe('2026-11-15')
    expect(wallClock(lateEvening, 'America/New_York').date).toBe('2026-11-14')
  })

  it('formats now as a LocalDateTime in the hotel time zone', () => {
    expect(nowISODateTime(lateEvening)).toBe('2026-11-15T01:30:00')
    expect(nowISODateTime(new Date('2026-11-15T18:29:59Z'))).toBe('2026-11-15T23:59:59')
  })

  it('falls back to the default zone for an unknown setting', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveTimeZone('Mars/Olympus')).toBe(DEFAULT_HOTEL_TIME_ZONE)
    expect(resolveTimeZone(' Europe/London ')).toBe('Europe/London')
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_HOTEL_TIME_ZONE)
  })
})
