/**
 * Chart styling shared by every Recharts chart (mirrors the tokens in index.css).
 * Categorical slots follow the validated fixed order; single-series charts use slot 1.
 */
export const CHART_COLORS = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const,
  grid: '#e8ebf1',
  axis: '#8a93a5',
  surface: '#ffffff',
  cursor: 'rgba(42, 120, 214, 0.06)',
}

/** Recessive axis styling: muted 12px ticks, no axis lines or tick marks. */
export const AXIS_PROPS = {
  tick: { fill: CHART_COLORS.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const

/** Minimal shape of the Recharts tooltip render-prop arguments we rely on. */
export interface TooltipRenderProps<D> {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: D }>
}

/** Returns the hovered datum, or null when the tooltip should be hidden. */
export function activeDatum<D>({ active, payload }: TooltipRenderProps<D>): D | null {
  return active && payload?.[0]?.payload ? payload[0].payload : null
}

/** Chart entrance animations are skipped for users who prefer reduced motion. */
export const CHART_ANIMATION =
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? false
    : !window.matchMedia('(prefers-reduced-motion: reduce)').matches
