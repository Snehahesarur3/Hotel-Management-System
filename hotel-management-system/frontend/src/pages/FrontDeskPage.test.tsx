import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import { AppProviders } from '@/routes/AppProviders'
import { routes } from '@/routes/router'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

const rowsOf = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1)
const booking = (id: string) => getDatabase().reservations.find((r) => r.id === id)!
const room = (id: string) => getDatabase().rooms.find((r) => r.id === id)!

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Front desk page', () => {
  it('shows arrivals, in-house guests and departures in tabs', async () => {
    renderAt('/front-desk')
    await screen.findByRole('table', { name: 'Arrivals' })
    expect(screen.getByRole('tab', { name: 'Arrivals (3)' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'In-house (14)' })).toBeInTheDocument()
    expect(rowsOf('Arrivals')).toHaveLength(3)

    await userEvent.click(screen.getByRole('tab', { name: 'Departures (3)' }))
    expect(await screen.findByRole('table', { name: 'Departures' })).toBeInTheDocument()
    expect(rowsOf('Departures').every((row) => /Due out today/.test(row.textContent ?? ''))).toBe(true)
  })

  it('checks a guest in after verifying their ID', async () => {
    renderAt('/front-desk')
    await screen.findByRole('table', { name: 'Arrivals' })
    await userEvent.click(screen.getByRole('button', { name: 'Check in BK-0027' }))
    const dialog = await screen.findByRole('dialog', { name: 'Check in Dev Bhatia' })
    const idField = await within(dialog).findByLabelText(/Last 4 characters of the guest's Driving License/)
    // The booked room is ready and preselected.
    expect(within(dialog).getByRole('radio', { name: /Room 104/ })).toBeChecked()

    await userEvent.type(idField, '1111')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Check in' }))
    expect(await within(dialog).findByText(/Doesn't match the Driving License on file/)).toBeInTheDocument()
    expect(booking('BK-0027').status).toBe('CONFIRMED')

    await userEvent.clear(idField)
    await userEvent.type(idField, '5607')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Check in' }))
    expect(await screen.findByText('Dev Bhatia checked in to Room 104')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Arrivals (2)' })).toBeInTheDocument())
    expect(room('RM-104').status).toBe('OCCUPIED')
  })

  it('finds a booking, shows the final bill and collects the balance at check-out', async () => {
    renderAt('/front-desk?q=BK-0013')
    await waitFor(() => expect(rowsOf('Search results')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Check out BK-0013' }))
    const dialog = await screen.findByRole('dialog', { name: 'Check out Arjun Reddy' })
    const pay = await within(dialog).findByRole('button', { name: 'Collect ₹10,087.00 & check out' })
    expect(within(dialog).getByText('Total').nextSibling).toHaveTextContent('₹14,007.00')
    expect(within(dialog).getByText(/Early departure/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Mock payment/)).toBeInTheDocument()

    await userEvent.click(pay)
    expect(await within(dialog).findByText('Choose how the guest is paying')).toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText(/Collect ₹10,087.00 by/), 'UPI')
    await userEvent.click(pay)

    expect(await screen.findByText('Arjun Reddy checked out · ₹10,087.00 collected. Room 102 sent for cleaning.')).toBeInTheDocument()
    expect(booking('BK-0013').status).toBe('CHECKED_OUT')
    expect(room('RM-102').status).toBe('CLEANING')
    expect(getDatabase().payments.at(-1)).toMatchObject({ reservationId: 'BK-0013', amount: 10087, method: 'UPI' })
  })

  it('checks out a settled stay without asking for payment', async () => {
    renderAt('/front-desk?tab=departures')
    await screen.findByRole('table', { name: 'Departures' })
    await userEvent.click(screen.getByRole('button', { name: 'Check out BK-0015' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Check out' }))
    expect(await screen.findByText(/checked out\. Room 108 sent for cleaning\./)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Departures (2)' })).toBeInTheDocument())
  })
})

describe('Reservation details front-desk actions', () => {
  it('offers check-in on an arriving booking', async () => {
    renderAt('/reservations/BK-0028')
    await userEvent.click(await screen.findByRole('button', { name: 'Check in' }))
    expect(await screen.findByRole('dialog', { name: /^Check in / })).toBeInTheDocument()
  })

  it('offers check-out on an in-house stay', async () => {
    renderAt('/reservations/BK-0013')
    await userEvent.click(await screen.findByRole('button', { name: 'Check out' }))
    expect(await screen.findByRole('dialog', { name: 'Check out Arjun Reddy' })).toBeInTheDocument()
  })
})
