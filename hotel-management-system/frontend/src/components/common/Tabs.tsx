import type { LucideIcon } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface TabItem<K extends string> {
  key: K
  label: string
  icon?: LucideIcon
  /** Optional count badge; also announced in the tab's accessible name. */
  count?: number
}

interface TabsProps<K extends string> {
  /** Accessible name of the tab list. */
  label: string
  /** Prefix for element ids (must be unique on the page). */
  idPrefix: string
  tabs: ReadonlyArray<TabItem<K>>
  value: K
  onChange: (key: K) => void
  /** Content of the selected tab. */
  children: ReactNode
  className?: string
}

/** Underlined tab bar with ARIA tabs semantics and arrow-key navigation (roving tabindex). */
export function Tabs<K extends string>({ label, idPrefix, tabs, value, onChange, children, className }: TabsProps<K>) {
  const tabId = (key: K) => `${idPrefix}-tab-${key}`
  const panelId = `${idPrefix}-panel`

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!offset) return
    event.preventDefault()
    const next = tabs[(index + offset + tabs.length) % tabs.length]!
    onChange(next.key)
    document.getElementById(tabId(next.key))?.focus()
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-3 pt-3">
        {tabs.map((t, index) => {
          const selected = t.key === value
          const Icon = t.icon
          return (
            <button
              key={t.key}
              id={tabId(t.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              aria-label={t.count !== undefined ? `${t.label} (${t.count})` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.key)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-600',
                selected ? 'border-brand-600 text-ink' : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {Icon && <Icon className="size-4" aria-hidden />}
              {t.label}
              {t.count !== undefined && (
                <span className={cn('rounded-full px-1.5 text-xs tabular-nums', selected ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-muted')}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={tabId(value)}>
        {children}
      </div>
    </div>
  )
}
