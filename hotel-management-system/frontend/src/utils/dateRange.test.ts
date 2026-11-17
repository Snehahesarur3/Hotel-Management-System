import { describe, expect, it } from 'vitest'
import { matchPreset, presetRange, RANGE_PRESETS } from './dateRange'

describe('report date presets', () => {
  it('computes inclusive ranges relative to today', () => {
    expect(presetRange('LAST_7_DAYS', '2026-11-11')).toEqual({ from: '2026-11-05', to: '2026-11-11' })
    expect(presetRange('LAST_30_DAYS', '2026-11-11')).toEqual({ from: '2026-10-13', to: '2026-11-11' })
    expect(presetRange('THIS_MONTH', '2026-11-11')).toEqual({ from: '2026-11-01', to: '2026-11-11' })
    expect(presetRange('LAST_MONTH', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(presetRange('LAST_MONTH', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(presetRange('THIS_YEAR', '2026-11-11')).toEqual({ from: '2026-01-01', to: '2026-11-11' })
    expect(presetRange('NEXT_30_DAYS', '2026-11-11')).toEqual({ from: '2026-11-11', to: '2026-12-10' })
  })

  it('recognises a preset range and treats anything else as custom', () => {
    // On the 20th no two presets produce the same range.
    for (const preset of RANGE_PRESETS) {
      expect(matchPreset(presetRange(preset, '2026-11-20'), '2026-11-20')).toBe(preset)
    }
    expect(matchPreset({ from: '2026-11-02', to: '2026-11-11' }, '2026-11-11')).toBeNull()
  })
})
