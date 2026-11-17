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

const table = () => screen.getByRole('table', { name: 'Rooms' })
const bodyRows = () => within(table()).getAllByRole('row').slice(1)

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Rooms page', () => {
  it('lists rooms with pagination', async () => {
    renderAt('/rooms')
    expect(await screen.findByRole('table', { name: 'Rooms' })).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(15)
    expect(screen.getByText(/of/, { selector: 'p' })).toHaveTextContent('Showing 1–15 of 50')

    await userEvent.click(screen.getByRole('button', { name: 'Page 4' }))
    await waitFor(() => expect(bodyRows()).toHaveLength(5))
  })

  it('filters by floor and type, keeping the filters in the URL', async () => {
    const router = renderAt('/rooms')
    await screen.findByRole('table', { name: 'Rooms' })

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Filter by floor' }), '5')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by room type' }), 'PRESIDENTIAL')
    await waitFor(() => expect(bodyRows()).toHaveLength(2))
    expect(router.state.location.search).toContain('floor=5')
    expect(router.state.location.search).toContain('type=PRESIDENTIAL')

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    await waitFor(() => expect(bodyRows()).toHaveLength(15))
  })

  it('searches after typing and shows an empty state with no matches', async () => {
    renderAt('/rooms')
    await screen.findByRole('table', { name: 'Rooms' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search rooms' }), 'zzzz')
    expect(await screen.findByText('No rooms match your filters')).toBeInTheDocument()
  })

  it('sorts when a column header is clicked', async () => {
    renderAt('/rooms')
    await screen.findByRole('table', { name: 'Rooms' })
    await userEvent.click(screen.getByRole('button', { name: /price \/ night/i }))
    await userEvent.click(screen.getByRole('button', { name: /price \/ night/i }))
    await waitFor(() => expect(within(bodyRows()[0]!).getByRole('link')).toHaveTextContent('509'))
    expect(screen.getByRole('columnheader', { name: /price \/ night/i })).toHaveAttribute('aria-sort', 'descending')
  })

  it('validates and adds a room, suggesting floor and tariff', async () => {
    renderAt('/rooms')
    await screen.findByRole('table', { name: 'Rooms' })
    await userEvent.click(screen.getByRole('button', { name: 'Add room' }))
    const dialog = screen.getByRole('dialog', { name: 'Add room' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add room' }))
    expect(await within(dialog).findByText('Use 3–4 digits, e.g. 204')).toBeInTheDocument()
    expect(within(dialog).getByText('Floor is required')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/room number/i), '511')
    expect(within(dialog).getByLabelText(/^floor/i)).toHaveValue(5)
    await userEvent.selectOptions(within(dialog).getByLabelText(/room type/i), 'SUITE')
    expect(within(dialog).getByLabelText(/price per night/i)).toHaveValue(12500)
    expect(within(dialog).getByLabelText(/capacity/i)).toHaveValue(4)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add room' }))
    expect(await screen.findByText('Room 511 added')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(getDatabase().rooms.find((r) => r.id === 'RM-511')).toMatchObject({ type: 'SUITE', floor: 5, pricePerNight: 12500 })
  })

  it('shows a duplicate room number next to the field', async () => {
    renderAt('/rooms')
    await screen.findByRole('table', { name: 'Rooms' })
    await userEvent.click(screen.getByRole('button', { name: 'Add room' }))
    const dialog = screen.getByRole('dialog', { name: 'Add room' })
    await userEvent.type(within(dialog).getByLabelText(/room number/i), '101')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add room' }))
    expect(await within(dialog).findByText('Room 101 already exists')).toBeInTheDocument()
  })

  it('edits a room from the list', async () => {
    renderAt('/rooms')
    await screen.findByRole('table', { name: 'Rooms' })
    await userEvent.click(screen.getByRole('button', { name: 'Edit room 101' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit room 101' })
    const price = within(dialog).getByLabelText(/price per night/i)
    await userEvent.clear(price)
    await userEvent.type(price, '3999')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Room 101 updated')).toBeInTheDocument()
    expect(getDatabase().rooms.find((r) => r.id === 'RM-101')!.pricePerNight).toBe(3999)
  })

  it('explains why a room with history cannot be deleted', async () => {
    renderAt('/rooms')
    await screen.findByRole('table', { name: 'Rooms' })
    await userEvent.click(screen.getByRole('button', { name: 'Delete room 101' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete room' }))
    expect(await screen.findByText(/has history .* cannot be deleted/)).toBeInTheDocument()
    expect(getDatabase().rooms).toHaveLength(50)
  })
})

describe('Room details page', () => {
  it('shows the room, its current guest and upcoming bookings', async () => {
    renderAt('/rooms/RM-102')
    expect(await screen.findByRole('heading', { level: 1, name: 'Room 102' })).toBeInTheDocument()
    expect(await screen.findByText('Arjun Reddy')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Upcoming reservations' })).toHaveTextContent('BK-0032')
  })

  it('changes the status of an available room', async () => {
    renderAt('/rooms/RM-101')
    await screen.findByRole('heading', { level: 1, name: 'Room 101' })
    await userEvent.click(screen.getByRole('button', { name: 'Change status' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('radio', { name: /maintenance/i }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update status' }))
    expect(await screen.findByText('Room 101 is now Maintenance')).toBeInTheDocument()
    expect(getDatabase().rooms.find((r) => r.id === 'RM-101')!.status).toBe('MAINTENANCE')
  })

  it('explains that an occupied room’s status is managed by check-out', async () => {
    renderAt('/rooms/RM-102')
    await screen.findByRole('heading', { level: 1, name: 'Room 102' })
    await userEvent.click(screen.getByRole('button', { name: 'Change status' }))
    expect(screen.getByText(/becomes Cleaning automatically when the guest checks out/)).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Update status' })).toBeDisabled()
  })

  it('shows a not-found state for unknown rooms', async () => {
    renderAt('/rooms/RM-999')
    expect(await screen.findByText('Room not found')).toBeInTheDocument()
  })
})
