import { QueryClient } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Restaurant orders', () => {
  it('lists and filters orders', async () => {
    renderAt('/restaurant')
    await screen.findByRole('table', { name: 'Orders' })
    expect(rowsOf('Orders')).toHaveLength(15)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by order status' }), 'PLACED')
    await waitFor(() => expect(rowsOf('Orders')).toHaveLength(2))
  })

  it('places an order charged to an in-house guest', async () => {
    renderAt('/restaurant')
    await screen.findByRole('table', { name: 'Orders' })
    await userEvent.click(screen.getByRole('button', { name: 'New order' }))
    const dialog = screen.getByRole('dialog', { name: 'New order' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Place order' }))
    expect(await within(dialog).findByText('Choose the guest or room to charge')).toBeInTheDocument()
    expect(within(dialog).getByText('Add at least one dish')).toBeInTheDocument()

    await waitFor(() => expect(within(dialog).getByLabelText(/Charge to/)).toBeEnabled())
    await userEvent.selectOptions(within(dialog).getByLabelText(/Charge to/), 'BK-0013')
    const more = await within(dialog).findByRole('button', { name: 'One more Paneer Tikka' })
    // Two clicks before React re-renders must both count (regression: stale quantity).
    act(() => {
      more.click()
      more.click()
    })
    expect(within(dialog).getByLabelText('Paneer Tikka quantity')).toHaveTextContent('2')
    expect(within(dialog).queryByRole('button', { name: 'One more Mango Kulfi' })).not.toBeInTheDocument() // unavailable
    await userEvent.click(within(dialog).getByRole('button', { name: 'Place order · ₹882.00' }))

    expect(await screen.findByText('ORD-0016 placed · ₹882.00 charged to Room 102')).toBeInTheDocument()
    expect(getDatabase().restaurantOrders.at(-1)).toMatchObject({ reservationId: 'BK-0013', items: [{ menuItemId: 'MNU-0005', quantity: 2, unitPrice: 420 }] })
  })

  it('moves an order through the kitchen and cancels with confirmation', async () => {
    renderAt('/restaurant?status=PLACED')
    await waitFor(() => expect(rowsOf('Orders')).toHaveLength(2))
    await userEvent.click(screen.getByRole('button', { name: 'Start preparing: ORD-0015' }))
    expect(await screen.findByText('ORD-0015 preparing')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel ORD-0014' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel order' }))
    expect(await screen.findByText('ORD-0014 cancelled')).toBeInTheDocument()
  })
})

describe('Restaurant menu', () => {
  it('toggles availability, adds a dish and protects ordered dishes', async () => {
    renderAt('/restaurant?tab=menu')
    await screen.findByRole('table', { name: 'Menu' })
    const kulfi = screen.getByRole('switch', { name: 'Mango Kulfi available' })
    expect(kulfi).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(kulfi)
    expect(await screen.findByText('Mango Kulfi is available')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add dish' }))
    const dialog = screen.getByRole('dialog', { name: 'Add dish' })
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'Prawn Balchão')
    await userEvent.type(within(dialog).getByLabelText(/Price/), '690')
    await userEvent.click(within(dialog).getByLabelText('Vegetarian'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add dish' }))
    expect(await screen.findByText('Prawn Balchão added to the menu')).toBeInTheDocument()
    expect(getDatabase().menuItems.find((m) => m.name === 'Prawn Balchão')).toMatchObject({ isVegetarian: false, price: 690 })

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search menu' }), 'fish curry')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Goan Fish Curry with Rice' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete dish' }))
    expect(await screen.findByText(/cannot be deleted\. Mark it unavailable/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Menu' })).toHaveAttribute('aria-selected', 'true')
  })
})
