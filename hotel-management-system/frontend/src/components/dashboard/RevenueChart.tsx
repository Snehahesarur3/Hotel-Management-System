import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard } from '@/components/common/ChartCard'
import { activeDatum, AXIS_PROPS, CHART_ANIMATION, CHART_COLORS, type TooltipRenderProps } from '@/components/common/chartTheme'
import { ChartTooltipBox } from '@/components/common/ChartTooltipBox'
import { DataTable } from '@/components/common/DataTable'
import type { RevenuePoint } from '@/types/dashboard'
import { formatCurrency, formatCurrencyAxis } from '@/utils/format'
import { sumMoney } from '@/utils/money'

interface RevenueChartProps {
  title: string
  points: RevenuePoint[]
  /** Short axis label for a period key. */
  axisLabel: (period: string) => string
  /** Full label for tooltips and the table. */
  fullLabel: (period: string) => string
  /** Defaults to the period total. */
  subtitle?: ReactNode
  actions?: ReactNode
}

interface Datum extends RevenuePoint {
  axis: string
  full: string
}

/** Single-series column chart of completed-payment revenue per period. */
export function RevenueChart({ title, points, axisLabel, fullLabel, subtitle, actions }: RevenueChartProps) {
  const data: Datum[] = points.map((p) => ({ ...p, axis: axisLabel(p.period), full: fullLabel(p.period) }))
  const total = sumMoney(points.map((p) => p.amount))

  return (
    <ChartCard
      title={title}
      subtitle={subtitle ?? `${formatCurrency(total, { whole: true })} collected in this period`}
      actions={actions}
      chart={
        <div className="h-56" role="img" aria-label={`${title}: ${data.map((d) => `${d.full} ${formatCurrency(d.amount)}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
              <XAxis dataKey="axis" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} width={52} tickFormatter={formatCurrencyAxis} />
              <Tooltip
                cursor={{ fill: CHART_COLORS.cursor }}
                content={(props: TooltipRenderProps<Datum>) => {
                  const d = activeDatum(props)
                  return d ? <ChartTooltipBox title={d.full} rows={[{ label: 'Revenue', value: formatCurrency(d.amount), color: CHART_COLORS.series[0] }]} /> : null
                }}
              />
              <Bar isAnimationActive={CHART_ANIMATION} dataKey="amount" fill={CHART_COLORS.series[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <DataTable
          caption={title}
          rows={data}
          rowKey={(d) => d.period}
          columns={[
            { key: 'period', header: 'Period', render: (d) => d.full },
            { key: 'amount', header: 'Revenue', align: 'right', render: (d) => formatCurrency(d.amount) },
          ]}
        />
      }
    />
  )
}
