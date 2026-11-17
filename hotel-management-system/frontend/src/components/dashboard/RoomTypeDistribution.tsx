import { useState } from 'react'
import { ChartCard } from '@/components/common/ChartCard'
import { CHART_COLORS } from '@/components/common/chartTheme'
import { DataTable } from '@/components/common/DataTable'
import type { RoomTypeBreakdown } from '@/types/dashboard'
import { enumLabel, formatPercent } from '@/utils/format'
import { cn } from '@/utils/cn'

/** Part-to-whole: one segmented bar of room counts per type, with a legend that also lists occupancy. */
export function RoomTypeDistribution({ roomTypes }: { roomTypes: RoomTypeBreakdown[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const total = roomTypes.reduce((sum, t) => sum + t.total, 0)
  const parts = roomTypes
    .filter((t) => t.total > 0)
    .map((t, i) => ({
      ...t,
      label: enumLabel(t.type),
      share: total ? (t.total / total) * 100 : 0,
      color: CHART_COLORS.series[i % CHART_COLORS.series.length]!,
    }))

  return (
    <ChartCard
      title="Room type distribution"
      subtitle={`${total} rooms across ${parts.length} categories`}
      chart={
        <div className="space-y-5">
          <div className="flex h-7 w-full gap-0.5" role="img" aria-label={parts.map((p) => `${p.label}: ${p.total} rooms`).join(', ')}>
            {parts.map((p) => (
              <div
                key={p.type}
                title={`${p.label}: ${p.total} rooms (${formatPercent(Math.round(p.share * 10) / 10)}), ${p.occupied} occupied`}
                onMouseEnter={() => setHovered(p.type)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  'flex items-center overflow-hidden rounded px-1.5 text-[11px] font-medium transition-opacity',
                  hovered && hovered !== p.type && 'opacity-40',
                )}
                style={{ width: `${p.share}%`, background: p.color, color: p.color === CHART_COLORS.series[3] ? '#0b0b0b' : '#ffffff' }}
              >
                {p.share >= 9 && <span className="truncate">{Math.round(p.share)}%</span>}
              </div>
            ))}
          </div>
          <ul className="space-y-2.5">
            {parts.map((p) => (
              <li
                key={p.type}
                onMouseEnter={() => setHovered(p.type)}
                onMouseLeave={() => setHovered(null)}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
                  <span className="truncate">{p.label}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                  <span className="font-medium text-ink">{p.total}</span> rooms · {p.occupied} occupied
                </span>
              </li>
            ))}
          </ul>
        </div>
      }
      table={
        <DataTable
          caption="Rooms by type"
          rows={parts}
          rowKey={(p) => p.type}
          columns={[
            { key: 'type', header: 'Room type', render: (p) => p.label },
            { key: 'total', header: 'Rooms', align: 'right', render: (p) => p.total },
            { key: 'occupied', header: 'Occupied', align: 'right', render: (p) => p.occupied },
            { key: 'share', header: 'Share', align: 'right', render: (p) => formatPercent(Math.round(p.share * 10) / 10) },
          ]}
        />
      }
    />
  )
}
