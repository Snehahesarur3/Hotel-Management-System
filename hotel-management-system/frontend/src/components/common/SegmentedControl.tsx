import { cn } from '@/utils/cn'

interface SegmentedControlProps<V extends string> {
  label: string
  value: V
  options: ReadonlyArray<{ value: V; label: string; disabled?: boolean; title?: string }>
  onChange: (value: V) => void
}

/** Small toggle group (e.g. Chart / Table). Uses radio semantics for screen readers. */
export function SegmentedControl<V extends string>({ label, value, options, onChange }: SegmentedControlProps<V>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-canvas p-0.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
              selected ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              'disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:text-ink-subtle',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
