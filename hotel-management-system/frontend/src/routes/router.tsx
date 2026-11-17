import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { RequireAuth, RequirePermission } from '@/auth/guards'
import type { Permission } from '@/auth/permissions'
import { AdminLayout } from '@/layouts/AdminLayout'
import { BillingPage } from '@/pages/BillingPage'
import { FrontDeskPage } from '@/pages/FrontDeskPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { InvoicePage } from '@/pages/InvoicePage'
import { GuestProfilePage } from '@/pages/GuestProfilePage'
import { HousekeepingPage } from '@/pages/HousekeepingPage'
import { GuestsPage } from '@/pages/GuestsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ReservationDetailsPage } from '@/pages/ReservationDetailsPage'
import { ReservationsPage } from '@/pages/ReservationsPage'
import { RestaurantPage } from '@/pages/RestaurantPage'
import { RoomDetailsPage } from '@/pages/RoomDetailsPage'
import { RoomsPage } from '@/pages/RoomsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SignInPage } from '@/pages/SignInPage'
import { StaffPage } from '@/pages/StaffPage'

/** Pathless layout route: its pages open only for users with the permission (see RequirePermission). */
const allow = (permission: Permission, children: RouteObject[]): RouteObject => ({
  element: <RequirePermission permission={permission} />,
  children,
})

/**
 * Route table. Everything except the sign-in page needs a signed-in user; each module's pages also need
 * the module's permission (the same one that shows it in the sidebar).
 */
export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    // Shown while a lazy route module loads on the first visit.
    hydrateFallbackElement: (
      <div role="status" className="grid min-h-full place-items-center text-sm text-ink-muted">
        Loading…
      </div>
    ),
    children: [
      allow('dashboard.view', [
        {
          index: true,
          // Lazy route: the charting library ships in the dashboard chunk, not the app shell.
          lazy: async () => ({ Component: (await import('@/pages/DashboardPage')).DashboardPage }),
        },
      ]),
      allow('rooms.view', [
        { path: 'rooms', element: <RoomsPage /> },
        { path: 'rooms/:roomId', element: <RoomDetailsPage /> },
      ]),
      allow('reservations.view', [
        { path: 'reservations', element: <ReservationsPage /> },
        { path: 'reservations/:reservationId', element: <ReservationDetailsPage /> },
      ]),
      allow('guests.view', [
        { path: 'guests', element: <GuestsPage /> },
        { path: 'guests/:guestId', element: <GuestProfilePage /> },
      ]),
      allow('frontDesk.view', [{ path: 'front-desk', element: <FrontDeskPage /> }]),
      allow('billing.view', [
        { path: 'billing', element: <BillingPage /> },
        { path: 'billing/invoices/:reservationId', element: <InvoicePage /> },
      ]),
      allow('housekeeping.view', [{ path: 'housekeeping', element: <HousekeepingPage /> }]),
      allow('restaurant.view', [{ path: 'restaurant', element: <RestaurantPage /> }]),
      allow('staff.view', [{ path: 'staff', element: <StaffPage /> }]),
      allow('inventory.view', [{ path: 'inventory', element: <InventoryPage /> }]),
      // Lazy like the dashboard: reports are the other page that needs the charting library.
      allow('reports.view', [
        { path: 'reports', lazy: async () => ({ Component: (await import('@/pages/ReportsPage')).ReportsPage }) },
      ]),
      allow('settings.view', [{ path: 'settings', element: <SettingsPage /> }]),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
