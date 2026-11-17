import { Hotel, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useCan } from '@/auth/useAuth'
import { NAV_ITEMS } from '@/routes/navigation'
import { cn } from '@/utils/cn'

interface SidebarProps {
  /** Mobile drawer state; the sidebar is always visible from the lg breakpoint. */
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const can = useCan()
  // Only the modules the signed-in user's role can open.
  const items = NAV_ITEMS.filter((item) => can(item.permission))
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn('fixed inset-0 z-30 bg-ink/40 transition-opacity lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        aria-hidden
        onClick={onClose}
      />
      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
              <Hotel className="size-4.5" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">Hotel Management</p>
              <p className="text-xs text-ink-subtle">Admin console</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-subtle hover:bg-canvas hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {items.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-brand-600',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-canvas hover:text-ink',
                    )
                  }
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
