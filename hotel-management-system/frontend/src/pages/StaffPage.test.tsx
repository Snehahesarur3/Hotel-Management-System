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

const rows = () => within(screen.getByRole('table', { name: 'Staff' })).getAllByRole('row').slice(1)

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Staff page', () => {
  it('lists staff with counts and filters by department and status', async () => {
    renderAt('/staff')
    await screen.findByRole('table', { name: 'Staff' })
    expect(rows()).toHaveLength(15)
    expect(screen.getByText('On leave')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by department' }), 'HOUSEKEEPING')
    await waitFor(() => expect(rows()).toHaveLength(4))
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by employment status' }), 'ON_LEAVE')
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(rows()[0]).toHaveTextContent('Fatima Sheikh')
  })

  it('adds a staff member with validation', async () => {
    renderAt('/staff')
    await screen.findByRole('table', { name: 'Staff' })
    await userEvent.click(screen.getByRole('button', { name: 'Add staff member' }))
    const dialog = screen.getByRole('dialog', { name: 'Add staff member' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add staff member' }))
    expect(await within(dialog).findByText('Enter the full name')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/Full name/), 'Neha Kamath')
    await userEvent.type(within(dialog).getByLabelText(/Work email/), 'neha.kamath@aureliabay.example')
    await userEvent.type(within(dialog).getByLabelText(/Phone/), '+91 90000 51111')
    await userEvent.type(within(dialog).getByLabelText(/Job title/), 'Front Office Associate')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add staff member' }))
    expect(await screen.findByText('Neha Kamath added')).toBeInTheDocument()
    expect(getDatabase().staff).toHaveLength(16)
  })

  it('blocks putting someone with open tasks on leave', async () => {
    renderAt('/staff?q=sunil')
    await waitFor(() => expect(rows()).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Edit Sunil Parab' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Sunil Parab' })
    await userEvent.selectOptions(within(dialog).getByLabelText(/Employment status/), 'ON_LEAVE')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByText('Sunil Parab has 3 open housekeeping tasks. Reassign them before changing the status.')).toBeInTheDocument()
  })

  it('removes staff without history and refuses those with history', async () => {
    renderAt('/staff')
    await screen.findByRole('table', { name: 'Staff' })
    await userEvent.click(screen.getByRole('button', { name: 'Delete Baldev Singh' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('Baldev Singh removed')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Sunil Parab' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText(/Sunil Parab has \d+ housekeeping tasks on record/)).toBeInTheDocument()
  })
})
