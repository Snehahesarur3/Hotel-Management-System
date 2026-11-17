import { Search, UserRound } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { TextInput } from '@/components/common/FormControls'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useGuestList } from '@/hooks/useGuests'
import { cn } from '@/utils/cn'

export interface PickedGuest {
  id: string
  fullName: string
  /** Secondary line, e.g. email. */
  detail: string
}

interface GuestPickerProps {
  value: PickedGuest | null
  onChange: (guest: PickedGuest | null) => void
  error?: string
  disabled?: boolean
}

const RESULT_LIMIT = 6

/** Search-as-you-type guest selector (scales to any number of guests, unlike a plain select). */
export function GuestPicker({ value, onChange, error, disabled }: GuestPickerProps) {
  const inputId = useId()
  const messageId = useId()
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim(), 250)
  const results = useGuestList({ search: debounced || undefined, size: RESULT_LIMIT, sort: { field: 'fullName', direction: 'asc' } })

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Guest</span>
        <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2">
          <UserRound className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{value.fullName}</p>
            <p className="truncate text-xs text-ink-muted">{value.detail}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled} aria-label={`Change guest (${value.fullName})`}>
            Change
          </Button>
        </div>
      </div>
    )
  }

  const guests = results.data?.content ?? []
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        Guest
        <span className="ml-0.5 text-danger" aria-hidden>
          *
        </span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <TextInput
          id={inputId}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          // Enter would submit the surrounding booking form.
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          placeholder="Search by name, email, phone or guest ID"
          autoComplete="off"
          className="pl-9"
          invalid={Boolean(error)}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          disabled={disabled}
        />
      </div>
      <div role="group" aria-label="Matching guests" className={cn('rounded-lg border border-line', results.isPlaceholderData && 'opacity-60')}>
        {results.isPending ? (
          <p className="px-3 py-2 text-sm text-ink-muted">Loading guests…</p>
        ) : results.isError ? (
          <p className="px-3 py-2 text-sm text-danger">Could not load guests: {results.error.message}</p>
        ) : guests.length === 0 ? (
          <p className="px-3 py-2 text-sm text-ink-muted">No guests match “{debounced}”.</p>
        ) : (
          <ul className="divide-y divide-line">
            {guests.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onChange({ id: g.id, fullName: g.fullName, detail: g.email })}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{g.fullName}</span>
                    <span className="block truncate text-xs text-ink-muted">{g.email}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-subtle">{g.id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error ? (
        <p id={messageId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p id={messageId} className="text-xs text-ink-muted">
          New guest?{' '}
          <Link to="/guests" className="font-medium text-brand-700 hover:underline">
            Register them on the Guests page
          </Link>
          , then come back to book.
        </p>
      )}
    </div>
  )
}
