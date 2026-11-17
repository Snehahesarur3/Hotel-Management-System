import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const CONTROL =
  'w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted'
const borderFor = (invalid?: boolean) => (invalid ? 'border-danger focus:border-danger focus:ring-danger-soft' : 'border-line')

interface FieldProps {
  label: string
  /** Validation message; also marks the control invalid. */
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  /** Render-prop receiving the id and aria attributes to spread on the control. */
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}

/** Label + control + hint/error, with ids wired for screen readers. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? messageId : undefined })}
      {error ? (
        <p id={messageId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-xs text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

type Invalid = { invalid?: boolean; ref?: Ref<HTMLElement> }

export function TextInput({ invalid, className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & Invalid) {
  return <input ref={ref as Ref<HTMLInputElement>} className={cn(CONTROL, 'h-9', borderFor(invalid), className)} {...props} />
}

export function SelectInput({ invalid, className, ref, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Invalid) {
  return (
    <select ref={ref as Ref<HTMLSelectElement>} className={cn(CONTROL, 'h-9 pr-8', borderFor(invalid), className)} {...props}>
      {children}
    </select>
  )
}

export function TextArea({ invalid, className, ref, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid) {
  return (
    <textarea ref={ref as Ref<HTMLTextAreaElement>} className={cn(CONTROL, 'min-h-20 py-2', borderFor(invalid), className)} {...props} />
  )
}

/** Input with a fixed prefix such as ₹. */
export function PrefixedInput({ prefix, invalid, className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & Invalid & { prefix: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-muted" aria-hidden>
        {prefix}
      </span>
      <input ref={ref as Ref<HTMLInputElement>} className={cn(CONTROL, 'h-9 pl-7', borderFor(invalid), className)} {...props} />
    </div>
  )
}
