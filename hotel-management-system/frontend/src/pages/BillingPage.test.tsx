import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import { mockReservationService } from '@/mock/services/reservations'
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
const charges = () => screen.getByRole('table', { name: 'Charges' })
const totalCell = () => within(charges()).getByRole('rowheader', { name: 'Total' }).nextElementSibling

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Billing page', () => {
  it('summarises balances and filters invoices', async () => {
    renderAt('/billing')
    expect(await screen.findByText('Pending payments')).toBeInTheDocument()
    expect(screen.getByText('₹25,000')).toBeInTheDocument() // the pending bank transfer
    await screen.findByRole('table', { name: 'Invoices' })
    expect(rowsOf('Invoices')).toHaveLength(15)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by balance' }), 'DUE')
    await waitFor(() => expect(rowsOf('Invoices').every((row) => /Due/.test(row.textContent ?? ''))).toBe(true))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by invoice state' }), 'FINAL')
    expect(await screen.findByText('No invoices match your filters')).toBeInTheDocument()
  })

  it('refunds a cancelled booking’s deposit from the invoice list', async () => {
    await mockReservationService.cancel('BK-0028')
    renderAt('/billing?balance=CREDIT')
    await waitFor(() => expect(rowsOf('Invoices')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Refund INV-0028' }))
    const dialog = screen.getByRole('dialog', { name: 'Refund ₹5,500.00' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refund ₹5,500.00' }))
    expect(await within(dialog).findByText('Choose how the refund is paid')).toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText(/Refund to/), 'CREDIT_CARD')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refund ₹5,500.00' }))
    expect(await screen.findByText(/₹5,500.00 refunded · MOCK-RFD-\d{6}/)).toBeInTheDocument()
    expect(await screen.findByText('No invoices match your filters')).toBeInTheDocument()
  })

  it('confirms a pending payment and keeps the payments tab when clearing filters', async () => {
    renderAt('/billing?tab=payments&status=PENDING')
    await waitFor(() => expect(rowsOf('Payments')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm PAY-0024 received' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm received' }))
    expect(await screen.findByText('PAY-0024 marked received')).toBeInTheDocument()
    expect(getDatabase().payments.find((p) => p.id === 'PAY-0024')!.status).toBe('COMPLETED')

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    await waitFor(() => expect(rowsOf('Payments').length).toBeGreaterThan(1))
    expect(screen.getByRole('tab', { name: 'Payments' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Invoice page', () => {
  it('adds and removes extras and discounts on an open folio', async () => {
    renderAt('/billing/invoices/BK-0013')
    expect(await screen.findByRole('heading', { level: 1, name: 'Invoice INV-0013' })).toBeInTheDocument()
    expect(totalCell()).toHaveTextContent('₹17,927.00')

    await userEvent.click(screen.getByRole('button', { name: 'Add charge' }))
    let dialog = screen.getByRole('dialog', { name: 'Add charge · INV-0013' })
    await userEvent.type(within(dialog).getByLabelText(/Description/), 'Laundry')
    await userEvent.type(within(dialog).getByLabelText(/Amount/), '500')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add charge' }))
    expect(await screen.findByText('Charge added: Laundry')).toBeInTheDocument()
    await waitFor(() => expect(totalCell()).toHaveTextContent('₹18,517.00'))

    await userEvent.click(screen.getByRole('button', { name: 'Add discount' }))
    dialog = screen.getByRole('dialog', { name: 'Add discount · INV-0013' })
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Loyalty')
    await userEvent.type(within(dialog).getByLabelText(/Percentage of room charges/), '10')
    expect(within(dialog).getByText(/₹1,400.00 off ₹14,000.00/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add discount' }))
    await waitFor(() => expect(totalCell()).toHaveTextContent('₹16,949.00'))

    await userEvent.click(screen.getByRole('button', { name: /^Remove Loyalty/ }))
    await waitFor(() => expect(totalCell()).toHaveTextContent('₹18,517.00'))
  })

  it('takes a part-payment through the mock gateway', async () => {
    renderAt('/billing/invoices/BK-0013')
    await userEvent.click(await screen.findByRole('button', { name: 'Record payment' }))
    const dialog = screen.getByRole('dialog', { name: 'Record payment · INV-0013' })
    expect(within(dialog).getByText(/Mock payment/)).toBeInTheDocument()
    const amount = within(dialog).getByLabelText(/Amount/)
    expect(amount).toHaveValue(14007)
    await userEvent.clear(amount)
    await userEvent.type(amount, '20000')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Payment method/), 'UPI')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Take payment' }))
    expect(await within(dialog).findByText('At most ₹14,007.00 (the balance due)')).toBeInTheDocument()

    await userEvent.clear(amount)
    await userEvent.type(amount, '5000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Take payment' }))
    expect(await screen.findByText(/₹5,000.00 received · MOCK-TXN-\d{6}/)).toBeInTheDocument()
    await waitFor(() => expect(within(charges()).getByRole('rowheader', { name: 'Balance due' }).nextElementSibling).toHaveTextContent('₹9,007.00'))
  })

  it('shows a locked final invoice with its GST summary', async () => {
    renderAt('/billing/invoices/BK-0001')
    expect(await screen.findByRole('heading', { level: 1, name: 'Invoice INV-0001' })).toBeInTheDocument()
    expect(screen.getByText('Tax invoice')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add charge' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
    const gst = screen.getByRole('table', { name: 'GST summary' })
    expect(within(gst).getAllByRole('row')).toHaveLength(3) // header + 5% + 12%
    expect(screen.getByText('GSTIN 30ABCDE1234F1Z5')).toBeInTheDocument()
  })

  it('is reachable from the reservation details page', async () => {
    const router = renderAt('/reservations/BK-0013')
    await userEvent.click(await screen.findByRole('link', { name: 'Open invoice' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Invoice INV-0013' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/billing/invoices/BK-0013')
  })
})
