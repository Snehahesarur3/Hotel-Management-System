import { SelectInput } from './FormControls'

interface FilterSelectProps {
  label: string
  value: string
  /** Text of the "no filter" option, e.g. "All floors". */
  allLabel: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
  className?: string
}

/** Compact select used in filter bars; the empty value means "no filter". */
export function FilterSelect({ label, value, allLabel, options, onChange, className }: FilterSelectProps) {
  return (
    <SelectInput aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={className ?? 'sm:w-44'}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </SelectInput>
  )
}
