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

const rows = () => within(screen.getByRole('table', { name: 'Housekeeping tasks' })).getAllByRole('row').slice(1)
const room = (id: string) => getDatabase().rooms.find((r) => r.id === id)!

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('Housekeeping page', () => {
  it('shows today’s queue with summary and filters by floor and staff', async () => {
    renderAt('/housekeeping')
    await screen.findByRole('table', { name: 'Housekeeping tasks' })
    expect(rows()).toHaveLength(13)
    expect(screen.getByText('Rooms to clean')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by floor' }), '5')
    await waitFor(() => expect(rows()).toHaveLength(2))

    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    await userEvent.click(await screen.findByRole('button', { name: /Maria D'Souza/ }))
    await waitFor(() => expect(rows().every((r) => /Maria D'Souza/.test(r.textContent ?? ''))).toBe(true))
  })

  it('starts and completes cleans, freeing the room', async () => {
    renderAt('/housekeeping')
    await screen.findByRole('table', { name: 'Housekeeping tasks' })
    await userEvent.click(screen.getByRole('button', { name: 'Start HK-0002' }))
    expect(await screen.findByText('Room 303 checkout clean started')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Complete HK-0001' }))
    expect(await screen.findByText('Room 107 checkout clean completed · room is now available')).toBeInTheDocument()
    expect(room('RM-107').status).toBe('AVAILABLE')
  })

  it('creates a task with validation', async () => {
    renderAt('/housekeeping')
    await screen.findByRole('table', { name: 'Housekeeping tasks' })
    await userEvent.click(screen.getByRole('button', { name: 'New task' }))
    const dialog = screen.getByRole('dialog', { name: 'New housekeeping task' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))
    expect(await within(dialog).findByText('Choose a room')).toBeInTheDocument()
    expect(within(dialog).getByText('Assign a staff member')).toBeInTheDocument()

    await waitFor(() => expect(within(dialog).getByLabelText(/Room/)).toBeEnabled())
    await userEvent.selectOptions(within(dialog).getByLabelText(/Room/), 'RM-201')
    await waitFor(() => expect(within(dialog).getByLabelText(/Assign to/)).toBeEnabled())
    await userEvent.selectOptions(within(dialog).getByLabelText(/Assign to/), 'STF-0006')
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Task/), 'INSPECTION')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))
    expect(await screen.findByText('Inspection for Room 201 assigned to Lakshmi Gaonkar')).toBeInTheDocument()
    await waitFor(() => expect(rows()).toHaveLength(14))
  })

  it('deletes a pending task after confirmation', async () => {
    renderAt('/housekeeping')
    await screen.findByRole('table', { name: 'Housekeeping tasks' })
    expect(screen.queryByRole('button', { name: 'Delete HK-0001' })).not.toBeInTheDocument() // in progress
    await userEvent.click(screen.getByRole('button', { name: 'Delete HK-0010' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete task' }))
    expect(await screen.findByText('HK-0010 deleted')).toBeInTheDocument()
    await waitFor(() => expect(rows()).toHaveLength(12))
  })
})
