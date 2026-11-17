import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard } from '@/components/common/ChartCard'
import { activeDatum, AXIS_PROPS, CHART_ANIMATION, CHART_COLORS, type TooltipRenderProps } from '@/components/common/chartTheme'
import { ChartTooltipBox } from '@/components/common/ChartTooltipBox'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/States'
import { formatPercent } from '@/utils/format'

export interface RankedDatum {
  key: string
  label: string
  value: number
}

interface RankedBarChartProps {
  title: string
  subtitle?: string
  data: RankedDatum[]
  /** What the value measures, e.g. "Net revenue". */
  valueLabel: string
  format: (value: number) => string
  /** Shorter format for the labels at the bar ends (defaults to `format`). */
  labelFormat?: (value: number) => string
  className?: string
}

interface Datum extends RankedDatum {
  share: number
}

/**
 * Horizontal bars in one hue, largest first: categories are compared by length,
 * with the value written at the end of each bar and a share column in the table view.
 */
export function RankedBarChart({ title, subtitle, data, valueLabel, format, labelFormat = format, className }: RankedBarChartProps) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0)
  const rows: Datum[] = [...data]
    .sort((a, b) => b.value - a.value)
    .map((d) => ({ ...d, share: total ? Math.round((d.value / total) * 1000) / 10 : 0 }))
  // Axis labels are 12px; about 7.5px per character plus padding keeps two-word labels on one line.
  const labelWidth = Math.min(140, Math.max(64, Math.round(Math.max(0, ...rows.map((d) => d.label.length)) * 7.5) + 20))
  const color = CHART_COLORS.series[0]

  return (
    <ChartCard
      className={className}
      title={title}
      subtitle={subtitle}
      chart={
        total === 0 ? (
          <EmptyState title="Nothing in this date range" className="py-8" />
        ) : (
          <div
            style={{ height: rows.length * 30 + 16 }}
            role="img"
            aria-label={`${title}: ${rows.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
                <XAxis type="number" hide domain={[0, 'dataMax']} />
                <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={labelWidth} interval={0} />
                <Tooltip
                  cursor={{ fill: CHART_COLORS.cursor }}
                  content={(props: TooltipRenderProps<Datum>) => {
                    const d = activeDatum(props)
                    return d ? (
                      <ChartTooltipBox
                        title={d.label}
                        rows={[
                          { label: valueLabel, value: format(d.value), color },
                          { label: 'Share', value: formatPercent(d.share) },
                        ]}
                      />
                    ) : null
                  }}
                />
                <Bar isAnimationActive={CHART_ANIMATION} dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={14}>
                  <LabelList dataKey="value" position="right" fill="#5b6577" fontSize={12} formatter={(v: unknown) => labelFormat(Number(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }
      table={
        <DataTable
          caption={title}
          rows={rows}
          rowKey={(d) => d.key}
          columns={[
            { key: 'label', header: 'Category', render: (d) => d.label },
            { key: 'value', header: valueLabel, align: 'right', render: (d) => format(d.value) },
            { key: 'share', header: 'Share', align: 'right', render: (d) => formatPercent(d.share) },
          ]}
        />
      }
    />
  )
}
