import { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import { AppProviders } from '@/routes/AppProviders'
import { routes } from '@/routes/router'
import { todayISO } from '@/utils/date'

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

const bodyRows = () => within(screen.getByRole('table', { name: 'Reservations' })).getAllByRole('row').slice(1)

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Reservations page', () => {
  it('lists, searches and filters bookings', async () => {
    renderAt('/reservations')
    await screen.findByRole('table', { name: 'Reservations' })
    expect(bodyRows()).toHaveLength(15)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'CANCELLED')
    await waitFor(() => expect(bodyRows()).toHaveLength(4))
    // Cancelled bookings offer no edit/cancel actions.
    expect(screen.queryByRole('button', { name: /^Cancel booking/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search reservations' }), 'BK-0027')
    await waitFor(() => expect(bodyRows()).toHaveLength(1))
    expect(bodyRows()[0]).toHaveTextContent('104')
  })

  it('creates a booking from live availability', async () => {
    renderAt('/reservations')
    await screen.findByRole('table', { name: 'Reservations' })
    await userEvent.click(screen.getByRole('button', { name: 'New reservation' }))
    const dialog = screen.getByRole('dialog', { name: 'New reservation' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create booking' }))
    expect(await within(dialog).findByText('Select a guest')).toBeInTheDocument()
    expect(within(dialog).getByText('Select an available room')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByRole('searchbox'), 'Diya')
    await userEvent.click(await within(dialog).findByRole('button', { name: /Diya Raman/ }))
    expect(within(dialog).getByRole('button', { name: 'Change guest (Diya Raman)' })).toBeInTheDocument()

    // Rooms already booked tonight are not offered.
    await within(dialog).findByRole('radio', { name: /Room 101 ·/ })
    expect(within(dialog).queryByRole('radio', { name: /Room 104 ·/ })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('radio', { name: /Room 101 ·/ }))
    expect(within(dialog).getByText('Estimated total').nextSibling).toHaveTextContent('₹3,920.00')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create booking' }))
    expect(await screen.findByText('Booking BK-0041 created for Diya Raman')).toBeInTheDocument()
    expect(getDatabase().rooms.find((r) => r.id === 'RM-101')!.status).toBe('RESERVED')
  })

  it('flags a selected room that is no longer free after a date change', async () => {
    renderAt('/reservations/BK-0032')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit booking BK-0032' })
    await within(dialog).findByRole('radio', { name: /Room 102 ·/ })

    // Room 102 has a guest in-house until tomorrow.
    fireEvent.change(within(dialog).getByLabelText(/check-in/i), { target: { value: todayISO() } })
    expect(await within(dialog).findByText(/selected room is not available/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(getDatabase().reservations.find((r) => r.id === 'BK-0032')!.checkIn).not.toBe(todayISO())
  })

  it('cancels a booking after confirmation and releases the room', async () => {
    renderAt('/reservations?q=BK-0027')
    await waitFor(() => expect(bodyRows()).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking BK-0027' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancel booking BK-0027?' })
    expect(dialog).toHaveTextContent('Room 104')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }))

    expect(await screen.findByText('Booking BK-0027 cancelled')).toBeInTheDocument()
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent('Cancelled'))
    expect(getDatabase().rooms.find((r) => r.id === 'RM-104')!.status).toBe('AVAILABLE')
  })
})

describe('Reservation details page', () => {
  it('shows the stay, guest, room and charges', async () => {
    renderAt('/reservations/BK-0001')
    expect(await screen.findByRole('heading', { level: 1, name: 'Booking BK-0001' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Aarav Mehta' })).toHaveAttribute('href', '/guests/GST-0001')
    expect(screen.getByRole('link', { name: 'Room 107' })).toHaveAttribute('href', '/rooms/RM-107')
    expect(screen.getByText('Room total incl. GST').nextSibling).toHaveTextContent('₹7,840.00')
    expect(within(screen.getByRole('table', { name: 'Payments' })).getByText('PAY-0001')).toBeInTheDocument()
    // Completed stays cannot be changed.
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('is reachable from a guest’s booking history', async () => {
    const router = renderAt('/guests/GST-0001')
    await userEvent.click(await screen.findByRole('link', { name: 'BK-0001' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Booking BK-0001' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reservations/BK-0001')
  })

  it('shows a not-found state for unknown bookings', async () => {
    renderAt('/reservations/BK-9999')
    expect(await screen.findByText('Reservation not found')).toBeInTheDocument()
  })
})
