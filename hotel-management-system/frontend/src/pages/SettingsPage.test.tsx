import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, resetDatabase } from '@/mock/db'
import { mockServices } from '@/mock/services'
import { AppProviders } from '@/routes/AppProviders'
import { routes } from '@/routes/router'
import { signInAs } from '@/test/auth'

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

beforeEach(() => {
  resetDatabase()
})

describe('Settings page', () => {
  it('lets the administrator edit the hotel profile, which then appears on invoices', async () => {
    renderAt('/settings')
    const name = await screen.findByRole('textbox', { name: /hotel name/i })
    expect(name).toHaveValue('Aurelia Bay Hotel')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await userEvent.clear(name)
    await userEvent.type(name, 'Aurelia Bay Resort')
    const gstin = screen.getByRole('textbox', { name: /gstin/i })
    await userEvent.clear(gstin)
    await userEvent.type(gstin, '30abcde1234f1z5')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Hotel profile saved')).toBeInTheDocument()
    expect(getDatabase().settings.hotel).toMatchObject({ name: 'Aurelia Bay Resort', gstin: '30ABCDE1234F1Z5' })
    const invoices = await mockServices.billing.invoices({ size: 1 })
    expect((await mockServices.billing.invoice(invoices.content[0]!.reservationId)).hotel.name).toBe('Aurelia Bay Resort')
  })

  it('validates the profile like the API, including the check-out time', async () => {
    renderAt('/settings')
    const email = await screen.findByRole('textbox', { name: /email/i })
    await userEvent.clear(email)
    await userEvent.type(email, 'not-an-email')
    const checkOut = screen.getByLabelText(/check-out time/i)
    await userEvent.clear(checkOut)
    await userEvent.type(checkOut, '15:00')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Check-out must be earlier than check-in, to leave time to clean the room')).toBeInTheDocument()
    expect(getDatabase().settings.hotel.email).toBe('frontdesk@aureliabay.example')

    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(email).toHaveValue('frontdesk@aureliabay.example'))
  })

  it('shows managers the profile read-only and keeps reception out', async () => {
    signInAs('MANAGER')
    renderAt('/settings')
    expect(await screen.findByText('Only the administrator can change the hotel profile.')).toBeInTheDocument()
    expect(screen.getByText('30ABCDE1234F1Z5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('keeps reception out of settings', async () => {
    signInAs('RECEPTIONIST')
    renderAt('/settings')
    expect(await screen.findByText('You don’t have access to this page')).toBeInTheDocument()
  })

  it('lists the GST rates read-only', async () => {
    renderAt('/settings?tab=taxes')
    const table = await screen.findByRole('table', { name: 'GST rates' })
    const rows = within(table).getAllByRole('row').slice(1).map((r) => r.textContent)
    expect(rows).toEqual([
      'Room tariff: Up to ₹7,500.00 per night12%',
      'Room tariff: Over ₹7,500.00 per night18%',
      'Food and beverages5%',
    ])
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows what each role may do', async () => {
    renderAt('/settings?tab=roles')
    const table = await screen.findByRole('table', { name: 'Permissions by role' })
    const row = within(table).getByRole('row', { name: /give discounts/i })
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Allowed', 'Allowed', 'Not allowed', 'Not allowed', 'Not allowed'])
    expect(screen.getByText('Demo accounts')).toBeInTheDocument()
  })

  it('resets the demo data from the data tab', async () => {
    const before = getDatabase().guests.length
    await mockServices.guests.create({
      fullName: 'Temporary Guest',
      email: 'temporary.guest@example.com',
      phone: '+91 90000 22222',
      address: '3 Lane, Pune',
      nationality: 'Indian',
      idProofType: 'PASSPORT',
      idProofNumber: 'K1234567',
    })
    renderAt('/settings?tab=data')
    expect(await screen.findByText('Mock data in this browser (localStorage)')).toBeInTheDocument()
    expect(screen.getByText('Asia/Kolkata')).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Reset demo data' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset data' }))
    await waitFor(() => expect(getDatabase().guests).toHaveLength(before))
  })
})
