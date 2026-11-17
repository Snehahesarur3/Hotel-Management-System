import { zodResolver } from '@hookform/resolvers/zod'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { Field, SelectInput, TextInput } from '@/components/common/FormControls'
import { rangeDays, reportRangeSchema, type ReportRangeFormValues } from '@/schemas/reports'
import type { ISODate } from '@/types/domain'
import type { ReportRange } from '@/types/reports'
import { matchPreset, presetRange, RANGE_PRESET_LABELS, RANGE_PRESETS, type RangePreset } from '@/utils/dateRange'
import { formatDate } from '@/utils/format'

interface ReportFiltersProps {
  range: ReportRange
  today: ISODate
  onChange: (range: ReportRange) => void
  /** Extra controls for the current report (e.g. revenue grouping). */
  children?: ReactNode
}

const CUSTOM = 'CUSTOM'

/**
 * Date range for every report: a quick preset, or any start and end date (applied with the button).
 * Validated with the same schema as the report service.
 */
export function ReportFilters({ range, today, onChange, children }: ReportFiltersProps) {
  // Re-mount the form when the applied range changes, so the inputs always show it.
  return (
    <Card className="p-4">
      <RangeForm key={`${range.from}_${range.to}`} range={range} today={today} onChange={onChange}>
        {children}
      </RangeForm>
    </Card>
  )
}

function RangeForm({ range, today, onChange, children }: ReportFiltersProps) {
  const preset = matchPreset(range, today)
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ReportRangeFormValues, unknown, ReportRange>({ resolver: zodResolver(reportRangeSchema), defaultValues: range })
  const days = rangeDays(range)

  return (
    <form onSubmit={handleSubmit(onChange)} noValidate className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,10rem)_minmax(0,10rem)_auto] sm:items-start">
        <Field label="Date range">
          {(a) => (
            <SelectInput
              {...a}
              value={preset ?? CUSTOM}
              onChange={(e) => e.target.value !== CUSTOM && onChange(presetRange(e.target.value as RangePreset, today))}
            >
              {RANGE_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {RANGE_PRESET_LABELS[p]}
                </option>
              ))}
              <option value={CUSTOM} disabled>
                Custom range
              </option>
            </SelectInput>
          )}
        </Field>
        <Field label="From" error={errors.from?.message}>
          {(a) => <TextInput {...a} type="date" invalid={Boolean(errors.from)} {...register('from')} />}
        </Field>
        <Field label="To" error={errors.to?.message}>
          {(a) => <TextInput {...a} type="date" invalid={Boolean(errors.to)} {...register('to')} />}
        </Field>
        <Button type="submit" variant="secondary" disabled={!isDirty} className="sm:mt-[1.625rem]">
          Apply dates
        </Button>
      </div>
      {children && <div className="lg:mb-0.5">{children}</div>}
      <p className="text-xs text-ink-muted lg:mb-2.5 lg:ml-auto" aria-live="polite">
        {formatDate(range.from)} – {formatDate(range.to)} · {days} day{days === 1 ? '' : 's'}
      </p>
    </form>
  )
}
