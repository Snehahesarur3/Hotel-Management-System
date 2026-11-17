import { QueryClient } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { sessionStore } from '@/auth/session'
import { resetDatabase } from '@/mock/db'
import { mockServices } from '@/mock/services'
import { signInAs, signOut } from '@/test/auth'
import { AppProviders } from './AppProviders'
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

const sidebarLinks = async () =>
  within(await screen.findByRole('complementary', { name: 'Main navigation' }))
    .getAllByRole('link')
    .map((l) => l.textContent)

beforeEach(() => {
  resetDatabase()
})

describe('sign-in', () => {
  it('sends visitors to the sign-in page and back to the page they asked for', async () => {
    signOut()
    const router = renderApp('/rooms?floor=2')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/sign-in')
    expect(screen.getByText(/not production authentication/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter your username')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/username/i), 'admin')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password')

    await userEvent.click(screen.getByRole('button', { name: 'Use the reception account' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Rooms' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?floor=2')
    expect(sessionStore.get()?.user).toEqual({ username: 'reception', roles: ['RECEPTIONIST'] })
  })

  it('signs out from the top bar', async () => {
    const router = renderApp('/')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out admin' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/sign-in')
    expect(screen.queryByText(/session has ended/i)).not.toBeInTheDocument()
  })

  it('explains an expired session', async () => {
    renderApp('/guests')
    expect(await screen.findByRole('heading', { level: 1, name: 'Guests' })).toBeInTheDocument()
    act(() => sessionStore.end('expired'))
    expect(await screen.findByText(/your session has ended/i)).toBeInTheDocument()
  })
})

describe('role-based interface', () => {
  it('shows housekeeping staff only their modules and explains blocked pages', async () => {
    signInAs('HOUSEKEEPING')
    renderApp('/reports')
    expect(await screen.findByText('You don’t have access to this page')).toBeInTheDocument()
    expect(screen.getByText(/signed in as housekeeping \(Housekeeping\)/i)).toBeInTheDocument()
    expect(await sidebarLinks()).toEqual(['Dashboard', 'Rooms', 'Housekeeping', 'Inventory'])
  })

  it('shows bookings on the dashboard as text, not links, to roles that cannot open them', async () => {
    signInAs('HOUSEKEEPING')
    renderApp('/')
    const card = (await screen.findByRole('heading', { name: 'Today’s check-ins' })).closest('section')!
    const guest = within(card).getByText('Amelia Clarke')
    expect(guest.closest('a')).toBeNull()
  })

  it('links bookings on the dashboard for reception', async () => {
    signInAs('RECEPTIONIST')
    renderApp('/')
    const card = (await screen.findByRole('heading', { name: 'Today’s check-ins' })).closest('section')!
    expect(within(card).getByRole('link', { name: 'Amelia Clarke' })).toHaveAttribute('href', expect.stringMatching(/^\/reservations\/BK-/))
  })

  it('hides room management from reception but keeps guest editing', async () => {
    signInAs('RECEPTIONIST')
    renderApp('/rooms')
    expect(await screen.findByRole('table', { name: 'Rooms' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add room' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit room/ })).not.toBeInTheDocument()
  })

  it('lets reception edit but not delete guests', async () => {
    signInAs('RECEPTIONIST')
    renderApp('/guests')
    expect(await screen.findByRole('table', { name: 'Guests' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Register guest' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Edit / }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument()
  })

  it('keeps discounts for managers on the invoice', async () => {
    const invoices = await mockServices.billing.invoices({ size: 100 })
    const inHouse = invoices.content.find((i) => i.state === 'INTERIM')!

    signInAs('RECEPTIONIST')
    renderApp(`/billing/invoices/${inHouse.reservationId}`)
    expect(await screen.findByRole('button', { name: 'Add charge' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add discount' })).not.toBeInTheDocument()
  })

  it('shows managers the discount action', async () => {
    const invoices = await mockServices.billing.invoices({ size: 100 })
    const inHouse = invoices.content.find((i) => i.state === 'INTERIM')!

    signInAs('MANAGER')
    renderApp(`/billing/invoices/${inHouse.reservationId}`)
    expect(await screen.findByRole('button', { name: 'Add discount' })).toBeInTheDocument()
  })
})
