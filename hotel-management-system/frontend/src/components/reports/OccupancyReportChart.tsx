import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard } from '@/components/common/ChartCard'
import { activeDatum, AXIS_PROPS, CHART_ANIMATION, CHART_COLORS, type TooltipRenderProps } from '@/components/common/chartTheme'
import { ChartTooltipBox } from '@/components/common/ChartTooltipBox'
import { DataTable } from '@/components/common/DataTable'
import type { OccupancyNight } from '@/types/reports'
import { formatCurrency, formatDate, formatMonth, formatPercent, formatShortDate } from '@/utils/format'

interface Datum extends OccupancyNight {
  /** Rate on the solid (actual) line; null on forecast nights. */
  actual: number | null
  /** Rate on the dashed (on the books) line; also set on the last actual night so the two lines join. */
  onBooks: number | null
}

const color = CHART_COLORS.series[0]

function LegendKey({ dashed, label }: { dashed?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="4" aria-hidden>
        <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      {label}
    </span>
  )
}

/** Occupancy per night: nights that have happened as a solid line, tonight onwards (bookings on the books) dashed. */
export function OccupancyReportChart({ nights }: { nights: OccupancyNight[] }) {
  const firstForecast = nights.findIndex((n) => n.forecast)
  const data: Datum[] = nights.map((n, i) => ({
    ...n,
    actual: n.forecast ? null : n.rate,
    onBooks: n.forecast || i === firstForecast - 1 ? n.rate : null,
  }))
  const hasActual = firstForecast !== 0
  const hasForecast = firstForecast !== -1
  const long = nights.length > 93
  const average = nights.length ? Math.round((nights.reduce((s, n) => s + n.rate, 0) / nights.length) * 10) / 10 : 0
  const first = nights[0]
  const last = nights.at(-1)

  return (
    <ChartCard
      title="Occupancy per night"
      subtitle={`${nights.length} night${nights.length === 1 ? '' : 's'} · average ${formatPercent(average)}`}
      chart={
        <div>
          {hasActual && hasForecast && (
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <LegendKey label="Actual" />
              <LegendKey dashed label="On the books (tonight onwards)" />
            </div>
          )}
          <div
            className="h-64"
            role="img"
            aria-label={`Occupancy per night${first && last ? ` from ${formatDate(first.date)} to ${formatDate(last.date)}` : ''}, averaging ${formatPercent(average)}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="date"
                  {...AXIS_PROPS}
                  tickFormatter={(d: string) => (long ? formatMonth(d.slice(0, 7), { withYear: true }) : formatShortDate(d))}
                  minTickGap={28}
                />
                <YAxis {...AXIS_PROPS} width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  cursor={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                  content={(props: TooltipRenderProps<Datum>) => {
                    const d = activeDatum(props)
                    return d ? (
                      <ChartTooltipBox
                        title={`${formatDate(d.date)}${d.forecast ? ' · on the books' : ''}`}
                        rows={[
                          { label: 'Occupancy', value: formatPercent(d.rate), color },
                          { label: 'Rooms sold', value: `${d.occupiedRooms} of ${d.totalRooms}` },
                          { label: 'Room revenue', value: formatCurrency(d.roomRevenue, { whole: true }) },
                        ]}
                      />
                    ) : null
                  }}
                />
                <Area
                  isAnimationActive={CHART_ANIMATION}
                  type="monotone"
                  dataKey="actual"
                  stroke={color}
                  strokeWidth={2}
                  fill={color}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 5, fill: color, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
                />
                <Area
                  isAnimationActive={CHART_ANIMATION}
                  type="monotone"
                  dataKey="onBooks"
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  fill={color}
                  fillOpacity={0.04}
                  dot={false}
                  activeDot={{ r: 5, fill: CHART_COLORS.surface, stroke: color, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      }
      table={
        <div className="max-h-72 overflow-y-auto">
          <DataTable
            caption="Occupancy per night"
            rows={nights}
            rowKey={(n) => n.date}
            columns={[
              { key: 'date', header: 'Night of', render: (n) => `${formatDate(n.date)}${n.forecast ? ' (on the books)' : ''}` },
              { key: 'rooms', header: 'Rooms sold', align: 'right', render: (n) => `${n.occupiedRooms} / ${n.totalRooms}` },
              { key: 'rate', header: 'Occupancy', align: 'right', render: (n) => formatPercent(n.rate) },
              { key: 'revenue', header: 'Room revenue', align: 'right', render: (n) => formatCurrency(n.roomRevenue) },
            ]}
          />
        </div>
      }
    />
  )
}
