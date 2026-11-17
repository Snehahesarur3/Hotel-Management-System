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

const bodyRows = () => within(screen.getByRole('table', { name: 'Guests' })).getAllByRole('row').slice(1)

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Guests page', () => {
  it('lists, searches and filters guests', async () => {
    renderAt('/guests')
    await screen.findByRole('table', { name: 'Guests' })
    expect(bodyRows()).toHaveLength(15)

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search guests' }), 'mehta')
    await waitFor(() => expect(bodyRows()).toHaveLength(1))
    expect(bodyRows()[0]).toHaveTextContent('Aarav Mehta')

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Filter by nationality' }), 'Japanese')
    await waitFor(() => expect(bodyRows()).toHaveLength(1))
    expect(bodyRows()[0]).toHaveTextContent('Kenji Watanabe')
  })

  it('registers a guest with validation and a masked ID', async () => {
    renderAt('/guests')
    await screen.findByRole('table', { name: 'Guests' })
    await userEvent.click(screen.getByRole('button', { name: 'Register guest' }))
    const dialog = screen.getByRole('dialog', { name: 'Register guest' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Register guest' }))
    expect(await within(dialog).findByText('Enter the full name')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter the ID number')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/full name/i), 'Rhea Costa')
    await userEvent.type(within(dialog).getByLabelText(/email/i), 'rhea.costa@example.com')
    await userEvent.type(within(dialog).getByLabelText(/phone/i), '+91 90000 11111')
    await userEvent.type(within(dialog).getByLabelText(/address/i), '12 Altinho, Panaji, Goa')
    await userEvent.type(within(dialog).getByLabelText(/id number/i), '1234')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register guest' }))
    expect(await within(dialog).findByText('Expected 12 digits')).toBeInTheDocument()

    await userEvent.clear(within(dialog).getByLabelText(/id number/i))
    await userEvent.type(within(dialog).getByLabelText(/id number/i), '1234 5678 9012')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register guest' }))
    expect(await screen.findByText('Rhea Costa added')).toBeInTheDocument()
    expect(getDatabase().guests.find((g) => g.fullName === 'Rhea Costa')?.idProofNumber).toBe('XXXX-XXXX-9012')
  })

  it('shows a duplicate email next to the field', async () => {
    renderAt('/guests')
    await screen.findByRole('table', { name: 'Guests' })
    await userEvent.click(screen.getByRole('button', { name: 'Edit Diya Raman' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Diya Raman' })
    const email = within(dialog).getByLabelText(/email/i)
    await userEvent.clear(email)
    await userEvent.type(email, 'aarav.mehta@example.com')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByText('This email is already registered to Aarav Mehta')).toBeInTheDocument()
  })

  it('refuses to delete a guest with reservations', async () => {
    renderAt('/guests')
    await screen.findByRole('table', { name: 'Guests' })
    await userEvent.click(screen.getByRole('button', { name: 'Delete Aarav Mehta' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete guest' }))
    expect(await screen.findByText(/has 2 reservations and cannot be deleted/)).toBeInTheDocument()
  })
})

describe('Guest profile page', () => {
  it('shows contact details, stats and booking history', async () => {
    renderAt('/guests/GST-0001')
    expect(await screen.findByRole('heading', { level: 1, name: 'Aarav Mehta' })).toBeInTheDocument()
    expect(screen.getByText('aarav.mehta@example.com')).toBeInTheDocument()
    const history = await screen.findByRole('table', { name: 'Booking history' })
    expect(within(history).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('₹15,502')).toBeInTheDocument()
  })

  it('is reachable from a room’s current stay', async () => {
    const router = renderAt('/rooms/RM-102')
    await userEvent.click(await screen.findByRole('link', { name: 'Arjun Reddy' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Arjun Reddy' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/guests/GST-0009')
  })

  it('shows a not-found state for unknown guests', async () => {
    renderAt('/guests/GST-9999')
    expect(await screen.findByText('Guest not found')).toBeInTheDocument()
  })
})
