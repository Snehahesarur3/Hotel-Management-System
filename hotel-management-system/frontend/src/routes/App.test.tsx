import { QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api'
import { resetDatabase } from '@/mock/db'
import { ApiError } from '@/types/api'
import { AppProviders } from './AppProviders'
import { NAV_ITEMS } from './navigation'
import { routes } from './router'

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

// The dashboard route is lazy; load its module once up front so tests measure UI, not transform time.
beforeAll(async () => {
  await import('@/pages/DashboardPage')
})

beforeEach(() => {
  resetDatabase()
})

describe('application shell', () => {
  it('shows all 12 modules in the sidebar', async () => {
    renderApp()
    const nav = await screen.findByRole('complementary', { name: 'Main navigation' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(NAV_ITEMS.map((i) => i.label))
    expect(links).toHaveLength(12)
  })

  it('navigates between modules from the sidebar', async () => {
    const router = renderApp()
    await userEvent.click(await screen.findByRole('link', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings')

    await userEvent.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', async () => {
    renderApp('/no-such-page')
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})

describe('dashboard page', () => {
  it('renders KPIs and lists derived from the mock data', async () => {
    renderApp()
    expect(await screen.findByText('Total rooms')).toBeInTheDocument()

    const kpi = (label: string) => screen.getByText(label).closest('div')!.parentElement!
    expect(within(kpi('Total rooms')).getByText('50')).toBeInTheDocument()
    expect(within(kpi('Available rooms')).getByText('29')).toBeInTheDocument()
    expect(within(kpi('Occupied rooms')).getByText('14')).toBeInTheDocument()
    expect(within(kpi('Occupancy rate')).getByText('28%')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Today’s check-ins' })).toBeInTheDocument()
    expect(screen.getByText('Amelia Clarke')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Weekly revenue' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Room occupancy trend' })).toBeInTheDocument()
  })

  it('switches a chart to its table view', async () => {
    renderApp()
    const heading = await screen.findByRole('heading', { name: 'Booking sources' })
    const card = heading.closest('section')!
    await userEvent.click(within(card).getByRole('radio', { name: 'Table' }))
    expect(within(card).getByRole('table')).toBeInTheDocument()
    expect(within(card).getByRole('cell', { name: 'Booking.com' })).toBeInTheDocument()
  })

  it('shows one error with a working retry when the summary fails', async () => {
    const summary = vi
      .spyOn(api.dashboard, 'summary')
      .mockRejectedValueOnce(new ApiError(0, 'Cannot reach the server'))
    renderApp()

    expect(await screen.findByText('Cannot reach the server')).toBeInTheDocument()
    summary.mockRestore()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText('Total rooms')).toBeInTheDocument()
  })
})
