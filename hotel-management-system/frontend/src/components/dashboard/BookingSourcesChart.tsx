import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard } from '@/components/common/ChartCard'
import { activeDatum, AXIS_PROPS, CHART_ANIMATION, CHART_COLORS, type TooltipRenderProps } from '@/components/common/chartTheme'
import { ChartTooltipBox } from '@/components/common/ChartTooltipBox'
import { DataTable } from '@/components/common/DataTable'
import type { CategoryCount } from '@/types/dashboard'
import type { BookingSource } from '@/types/enums'
import { enumLabel, formatPercent } from '@/utils/format'

interface Datum {
  key: BookingSource
  label: string
  count: number
  share: number
}

/**
 * Ranked horizontal bars in one hue: seven channels are compared by length,
 * which reads more accurately than a seven-colour pie.
 */
export function BookingSourcesChart({ sources }: { sources: CategoryCount<BookingSource>[] }) {
  const total = sources.reduce((sum, s) => sum + s.count, 0)
  const data: Datum[] = sources.map((s) => ({
    key: s.key,
    label: enumLabel(s.key),
    count: s.count,
    share: total ? Math.round((s.count / total) * 1000) / 10 : 0,
  }))

  return (
    <ChartCard
      title="Booking sources"
      subtitle={`${total} active and past reservations (cancellations excluded)`}
      chart={
        <div className="h-64" role="img" aria-label={`Bookings by source: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={92} />
              <Tooltip
                cursor={{ fill: CHART_COLORS.cursor }}
                content={(props: TooltipRenderProps<Datum>) => {
                  const d = activeDatum(props)
                  return d ? (
                    <ChartTooltipBox
                      title={d.label}
                      rows={[
                        { label: 'Reservations', value: d.count, color: CHART_COLORS.series[0] },
                        { label: 'Share', value: formatPercent(d.share) },
                      ]}
                    />
                  ) : null
                }}
              />
              <Bar isAnimationActive={CHART_ANIMATION} dataKey="count" fill={CHART_COLORS.series[0]} radius={[0, 4, 4, 0]} barSize={14}>
                <LabelList dataKey="count" position="right" fill="#5b6577" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <DataTable
          caption="Booking sources"
          rows={data}
          rowKey={(d) => d.key}
          columns={[
            { key: 'source', header: 'Source', render: (d) => d.label },
            { key: 'count', header: 'Reservations', align: 'right', render: (d) => d.count },
            { key: 'share', header: 'Share', align: 'right', render: (d) => formatPercent(d.share) },
          ]}
        />
      }
    />
  )
}
