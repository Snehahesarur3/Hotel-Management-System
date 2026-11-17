import { Download } from 'lucide-react'
import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/common/Button'
import { Card, CardHeader } from '@/components/common/Card'
import { DataTable, type Column } from '@/components/common/DataTable'
import type { ReportRange } from '@/types/reports'
import { cn } from '@/utils/cn'
import { csvFilename, downloadCsv, toCsv, type CsvColumn, type CsvValue } from '@/utils/csv'

/**
 * Table column that can also be exported: `csv` returns the raw value (numbers unformatted).
 * `exportOnly` columns are written to the CSV but not shown on screen.
 */
export type ReportColumn<T> = Omit<Column<T>, 'header' | 'render'> & {
  header: string
  csv?: (row: T) => CsvValue
} & ({ exportOnly: true; render?: never } | { exportOnly?: false; render: Column<T>['render'] })

function csvColumns<T>(columns: readonly ReportColumn<T>[]): CsvColumn<T>[] {
  return columns.flatMap((c) => (c.csv ? [{ header: c.header, value: c.csv }] : []))
}

function visibleColumns<T>(columns: readonly ReportColumn<T>[]): Column<T>[] {
  return columns.flatMap((c) => (c.exportOnly ? [] : [{ ...c, render: c.render }]))
}

interface ExportCsvButtonProps<T> {
  /** Report name: used in the file name and the button's accessible name. */
  name: string
  range: ReportRange
  rows: readonly T[]
  columns: readonly CsvColumn<T>[]
}

/** Downloads exactly the rows on screen as CSV (works the same in mock and backend mode). */
export function ExportCsvButton<T>({ name, range, rows, columns }: ExportCsvButtonProps<T>) {
  const onExport = () => {
    const filename = csvFilename(name, range)
    downloadCsv(filename, toCsv(columns, rows))
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'} to ${filename}`)
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<Download className="size-3.5" aria-hidden />}
      disabled={rows.length === 0}
      aria-label={`Export ${name} as CSV`}
      onClick={onExport}
    >
      Export
    </Button>
  )
}

interface ReportTableProps<T> {
  title: string
  subtitle?: ReactNode
  range: ReportRange
  rows: readonly T[]
  columns: ReportColumn<T>[]
  rowKey: (row: T) => string
  emptyTitle?: string
  /** Caps the height and scrolls long tables inside the card. */
  scroll?: boolean
  className?: string
}

/** Card with a report table and a CSV export of the same rows. */
export function ReportTable<T>({ title, subtitle, range, rows, columns, rowKey, emptyTitle, scroll, className }: ReportTableProps<T>) {
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={<ExportCsvButton name={title} range={range} rows={rows} columns={csvColumns(columns)} />}
      />
      <div className={cn(scroll && 'max-h-[28rem] overflow-y-auto')}>
        <DataTable caption={title} rows={rows} columns={visibleColumns(columns)} rowKey={rowKey} emptyTitle={emptyTitle ?? 'Nothing in this date range'} />
      </div>
    </Card>
  )
}
