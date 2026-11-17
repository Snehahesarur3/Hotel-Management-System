import { useState, type ReactNode } from 'react'
import { Card, CardBody, CardHeader } from './Card'
import { SegmentedControl } from './SegmentedControl'

type View = 'chart' | 'table'
const VIEWS = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
] as const

interface ChartCardProps {
  title: string
  subtitle?: ReactNode
  /** Rendered when the chart view is active. */
  chart: ReactNode
  /** Accessible data table alternative to the chart. */
  table: ReactNode
  /** Extra header controls (e.g. an export button), shown before the view toggle. */
  actions?: ReactNode
  className?: string
}

/** Card with a Chart / Table toggle, so every chart's data is also available as text. */
export function ChartCard({ title, subtitle, chart, table, actions, className }: ChartCardProps) {
  const [view, setView] = useState<View>('chart')
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            <SegmentedControl label={`${title} view`} value={view} options={VIEWS} onChange={setView} />
          </>
        }
      />
      <CardBody>{view === 'chart' ? chart : table}</CardBody>
    </Card>
  )
}
