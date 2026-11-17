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
const item = (id: string) => getDatabase().inventory.find((i) => i.id === id)!

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Inventory page', () => {
  it('shows low-stock alerts and filters to items that need reordering', async () => {
    renderAt('/inventory')
    expect(await screen.findByText('Low-stock alerts')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Stock in / }).length).toBeGreaterThanOrEqual(5)
    await screen.findByRole('table', { name: 'Inventory' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by stock level' }), 'LOW')
    await waitFor(() => expect(rowsOf('Inventory')).toHaveLength(5))
  })

  it('receives stock from an alert and clears it', async () => {
    renderAt('/inventory')
    await screen.findByText('Low-stock alerts')
    const alert = screen.getByText('Low-stock alerts').closest('section')!
    await userEvent.click(within(alert).getByRole('button', { name: 'Stock in Glass Cleaner 1 L' }))
    const dialog = screen.getByRole('dialog', { name: 'Stock in · Glass Cleaner 1 L' })
    expect(within(dialog).getByLabelText(/Quantity/)).toHaveValue(32) // up to twice the reorder level
    await userEvent.click(within(dialog).getByRole('button', { name: 'Receive stock' }))
    expect(await screen.findByText('Received 32 bottles of Glass Cleaner 1 L · 40 in stock')).toBeInTheDocument()
    await waitFor(() => expect(within(alert).queryByText('Glass Cleaner 1 L')).not.toBeInTheDocument())
    expect(item('INV-0013').quantity).toBe(40)
  })

  it('refuses to issue more than is on hand and records history', async () => {
    renderAt('/inventory?q=battery')
    await waitFor(() => expect(rowsOf('Inventory')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Stock out Door Lock Battery (AA)' }))
    let dialog = screen.getByRole('dialog', { name: 'Stock out · Door Lock Battery (AA)' })
    await userEvent.type(within(dialog).getByLabelText(/Quantity/), '5')
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Issued to maintenance')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Issue stock' }))
    expect(await within(dialog).findByText('Only 4 packs in stock')).toBeInTheDocument()

    await userEvent.clear(within(dialog).getByLabelText(/Quantity/))
    await userEvent.type(within(dialog).getByLabelText(/Quantity/), '3')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Issue stock' }))
    expect(await screen.findByText('Issued 3 packs of Door Lock Battery (AA) · 1 in stock')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Stock history of Door Lock Battery (AA)' }))
    dialog = await screen.findByRole('dialog', { name: 'Stock history · Door Lock Battery (AA)' })
    const history = await within(dialog).findByRole('table', { name: 'Stock movements' })
    expect(within(history).getAllByRole('row')[1]).toHaveTextContent(/Issued to maintenance.*−3.*1/)
  })

  it('adds an item with supplier details filled from a known supplier', async () => {
    renderAt('/inventory')
    await screen.findByRole('table', { name: 'Inventory' })
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    const dialog = screen.getByRole('dialog', { name: 'Add inventory item' })
    await userEvent.type(within(dialog).getByLabelText(/Item name/), 'Pool Towel (Blue)')
    await userEvent.clear(within(dialog).getByLabelText(/Opening stock/))
    await userEvent.type(within(dialog).getByLabelText(/Opening stock/), '50')
    await userEvent.type(within(dialog).getByLabelText(/Reorder level/), '40')
    await userEvent.type(within(dialog).getByLabelText(/Unit cost/), '380')
    await waitFor(() => expect(document.querySelectorAll('datalist option').length).toBeGreaterThan(0))
    await userEvent.type(within(dialog).getByLabelText(/Supplier name/), 'Coastal Linen Co.')
    expect(within(dialog).getByLabelText(/Contact person/)).toHaveValue('Rita Fernandes')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add item' }))
    expect(await screen.findByText('Pool Towel (Blue) added')).toBeInTheDocument()
    expect(getDatabase().stockMovements.at(-1)).toMatchObject({ reason: 'Opening stock', quantity: 50 })
  })

  it('lists suppliers and jumps to their items', async () => {
    renderAt('/inventory?tab=suppliers')
    await screen.findByRole('table', { name: 'Suppliers' })
    expect(rowsOf('Suppliers')).toHaveLength(6)
    await userEvent.click(screen.getByRole('button', { name: 'Show 5 items from BrightCare Supplies' }))
    await waitFor(() => expect(rowsOf('Inventory')).toHaveLength(5))
    expect(screen.getByText('Supplier: BrightCare Supplies')).toBeInTheDocument()
  })
})
