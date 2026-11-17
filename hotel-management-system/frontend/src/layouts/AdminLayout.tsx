import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

/** Application shell: fixed sidebar (drawer on small screens), sticky top bar, routed content. */
export function AdminLayout() {
  const { pathname } = useLocation()
  // The mobile drawer remembers the route it was opened on, so any navigation
  // (link click, back/forward) closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const navOpen = openedOn === pathname
  const setNavOpen = (open: boolean) => setOpenedOn(open ? pathname : null)

  return (
    <div className="min-h-full">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="print:hidden">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      </div>
      <div className="flex min-h-full flex-col lg:pl-64 print:pl-0">
        <div className="contents print:hidden">
          <Topbar onOpenNavigation={() => setNavOpen(true)} />
        </div>
        <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
