import { CalendarDays, Menu } from 'lucide-react'
import { demoData } from '@/api'
import { formatLongDate } from '@/utils/format'
import { todayISO } from '@/utils/date'
import { DataSourceIndicator } from './DataSourceIndicator'
import { DemoDataReset } from './DemoDataReset'
import { UserMenu } from './UserMenu'

interface TopbarProps {
  onOpenNavigation: () => void
}

export function Topbar({ onOpenNavigation }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenNavigation}
        className="-ml-1 rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink lg:hidden"
        aria-label="Open navigation"
        aria-controls="app-sidebar"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <p className="hidden items-center gap-2 text-sm text-ink-muted sm:flex">
        <CalendarDays className="size-4" aria-hidden />
        {formatLongDate(todayISO())}
      </p>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1">
          <DataSourceIndicator />
          {demoData && <DemoDataReset controls={demoData} />}
        </div>
        <UserMenu />
      </div>
    </header>
  )
}
