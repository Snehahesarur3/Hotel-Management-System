import type { ReactNode } from 'react'

interface ChartTooltipBoxProps {
  title: ReactNode
  rows: ReadonlyArray<{ label: string; value: ReactNode; color?: string }>
}

/** Tooltip body: title plus label/value rows, with a colour key beside each label (never coloured text). */
export function ChartTooltipBox({ title, rows }: ChartTooltipBoxProps) {
  return (
    <div className="min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-overlay">
      <p className="mb-1 font-medium text-ink">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center justify-between gap-4 text-ink-muted">
          <span className="flex items-center gap-1.5">
            {row.color && <span className="size-2 rounded-full" style={{ background: row.color }} aria-hidden />}
            {row.label}
          </span>
          <span className="font-medium text-ink tabular-nums">{row.value}</span>
        </p>
      ))}
    </div>
  )
}
