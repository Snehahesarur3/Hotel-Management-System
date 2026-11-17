import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/utils/cn'

interface SearchInputProps {
  /** Committed value (e.g. from the URL). */
  value: string
  /** Called with the debounced text. */
  onSearch: (value: string) => void
  placeholder?: string
  label: string
  className?: string
}

/** Search box that reports changes after the user pauses typing (300 ms), with a clear button. */
export function SearchInput({ value, onSearch, placeholder, label, className }: SearchInputProps) {
  const [text, setText] = useState(value)
  /** The last text this box reported itself, to tell our own echoes from external changes. */
  const [reported, setReported] = useState(value)

  // Follow external changes such as "Clear filters" or browser navigation. When `value` merely
  // echoes what we reported, keep the text: the user may already have typed further.
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    if (value !== reported) {
      setText(value)
      setReported(value)
    }
  }

  const debounced = useDebouncedValue(text)
  const latest = useRef({ value, onSearch })
  useEffect(() => {
    latest.current = { value, onSearch }
  })
  useEffect(() => {
    if (debounced !== latest.current.value) {
      setReported(debounced)
      latest.current.onSearch(debounced)
    }
  }, [debounced])

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-full rounded-lg border border-line bg-surface pr-8 pl-9 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-ink-subtle hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
