import type { ISODate } from '@/types/domain'
import type { ReportRange } from '@/types/reports'
import { addDays } from './date'

/** Quick ranges offered by the report filters. All are inclusive and computed against `today`. */
export const RANGE_PRESETS = [
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'THIS_MONTH',
  'LAST_MONTH',
  'THIS_YEAR',
  'NEXT_30_DAYS',
] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  LAST_7_DAYS: 'Last 7 days',
  LAST_30_DAYS: 'Last 30 days',
  LAST_90_DAYS: 'Last 90 days',
  THIS_MONTH: 'This month',
  LAST_MONTH: 'Last month',
  THIS_YEAR: 'This year',
  NEXT_30_DAYS: 'Next 30 days',
}

export const DEFAULT_RANGE_PRESET: RangePreset = 'LAST_30_DAYS'

const firstOfMonth = (iso: ISODate) => `${iso.slice(0, 7)}-01`

export function presetRange(preset: RangePreset, today: ISODate): ReportRange {
  switch (preset) {
    case 'LAST_7_DAYS':
      return { from: addDays(today, -6), to: today }
    case 'LAST_30_DAYS':
      return { from: addDays(today, -29), to: today }
    case 'LAST_90_DAYS':
      return { from: addDays(today, -89), to: today }
    case 'THIS_MONTH':
      return { from: firstOfMonth(today), to: today }
    case 'LAST_MONTH': {
      const lastDay = addDays(firstOfMonth(today), -1)
      return { from: firstOfMonth(lastDay), to: lastDay }
    }
    case 'THIS_YEAR':
      return { from: `${today.slice(0, 4)}-01-01`, to: today }
    case 'NEXT_30_DAYS':
      return { from: today, to: addDays(today, 29) }
  }
}

/** The preset that produces exactly this range today, or null for a custom range. */
export function matchPreset(range: ReportRange, today: ISODate): RangePreset | null {
  return RANGE_PRESETS.find((p) => {
    const candidate = presetRange(p, today)
    return candidate.from === range.from && candidate.to === range.to
  }) ?? null
}
