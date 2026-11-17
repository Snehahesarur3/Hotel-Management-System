import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard } from '@/components/common/ChartCard'
import { activeDatum, AXIS_PROPS, CHART_ANIMATION, CHART_COLORS, type TooltipRenderProps } from '@/components/common/chartTheme'
import { ChartTooltipBox } from '@/components/common/ChartTooltipBox'
import { DataTable } from '@/components/common/DataTable'
import type { OccupancyPoint } from '@/types/dashboard'
import { formatDate, formatPercent, formatShortDate } from '@/utils/format'

interface OccupancyTrendChartProps {
  nights: OccupancyPoint[]
  className?: string
}

/** Occupancy rate per night: 2px line with a 10% area wash, crosshair tooltip. */
export function OccupancyTrendChart({ nights, className }: OccupancyTrendChartProps) {
  const average = nights.length ? nights.reduce((sum, n) => sum + n.rate, 0) / nights.length : 0
  const latest = nights.at(-1)
  const color = CHART_COLORS.series[0]

  return (
    <ChartCard
      className={className}
      title="Room occupancy trend"
      subtitle={`Last ${nights.length} nights · average ${formatPercent(Math.round(average * 10) / 10)}${latest ? ` · last night ${formatPercent(latest.rate)}` : ''}`}
      chart={
        <div className="h-64" role="img" aria-label={`Occupancy rate per night over the last ${nights.length} nights, averaging ${formatPercent(Math.round(average))}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={nights} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
              <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={formatShortDate} minTickGap={24} />
              <YAxis {...AXIS_PROPS} width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                cursor={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
                content={(props: TooltipRenderProps<OccupancyPoint>) => {
                  const d = activeDatum(props)
                  return d ? (
                    <ChartTooltipBox
                      title={formatDate(d.date)}
                      rows={[
                        { label: 'Occupancy', value: formatPercent(d.rate), color },
                        { label: 'Rooms occupied', value: `${d.occupiedRooms} of ${d.totalRooms}` },
                      ]}
                    />
                  ) : null
                }}
              />
              <Area
                isAnimationActive={CHART_ANIMATION}
                type="monotone"
                dataKey="rate"
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 5, fill: color, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <div className="max-h-64 overflow-y-auto">
          <DataTable
            caption="Occupancy per night"
            rows={[...nights].reverse()}
            rowKey={(n) => n.date}
            columns={[
              { key: 'date', header: 'Night of', render: (n) => formatDate(n.date) },
              { key: 'rooms', header: 'Rooms occupied', align: 'right', render: (n) => `${n.occupiedRooms} / ${n.totalRooms}` },
              { key: 'rate', header: 'Occupancy', align: 'right', render: (n) => formatPercent(n.rate) },
            ]}
          />
        </div>
      }
    />
  )
}
