import { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reloadDatabaseFromStorage } from '@/mock/db'
import { AppProviders } from '@/routes/AppProviders'
import { routes } from '@/routes/router'
import { addDays, todayISO } from '@/utils/date'

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

const TODAY = todayISO()
const stat = (label: string) => screen.getByText(label, { selector: 'p' }).closest('div')!.parentElement!
const rowsOf = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1)

// The reports route is lazy; load it once up front so tests measure UI, not transform time.
beforeAll(async () => {
  await import('@/pages/ReportsPage')
})

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Reports page', () => {
  it('shows revenue for the last 30 days by default and keeps the range in the URL', async () => {
    const router = renderAt('/reports')
    expect(await screen.findByRole('heading', { level: 1, name: 'Reports & Analytics' })).toBeInTheDocument()
    expect(await screen.findByText('Net revenue', { selector: 'p' })).toBeInTheDocument()
    expect(within(stat('Net revenue')).getByText('₹1,57,266')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Date range' })).toHaveValue('LAST_30_DAYS')
    expect(screen.getByRole('heading', { name: 'Net revenue by day' })).toBeInTheDocument()
    expect(rowsOf('Revenue by period')).toHaveLength(30)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Date range' }), 'LAST_7_DAYS')
    await waitFor(() => expect(rowsOf('Revenue by period')).toHaveLength(7))
    expect(router.state.location.search).toContain(`from=${addDays(TODAY, -6)}`)
  })

  it('groups revenue by month and only allows daily figures for short ranges', async () => {
    renderAt('/reports?tab=revenue')
    await screen.findByRole('table', { name: 'Revenue by period' })
    await userEvent.click(screen.getByRole('radio', { name: 'Monthly' }))
    expect(await screen.findByRole('heading', { name: 'Net revenue by month' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Daily' }))
    await screen.findByRole('heading', { name: 'Net revenue by day' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Date range' }), 'THIS_YEAR')
    expect(await screen.findByRole('heading', { name: 'Net revenue by month' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Daily' })).toBeDisabled()
  })

  it('validates a custom range before applying it', async () => {
    const router = renderAt('/reports?tab=payments')
    await screen.findByRole('table', { name: 'Transactions' })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: TODAY } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: addDays(TODAY, -3) } })
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }))
    expect(await screen.findByText('The end date must be on or after the start date')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: addDays(TODAY, -3) } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: TODAY } })
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }))
    await waitFor(() => expect(router.state.location.search).toContain(`from=${addDays(TODAY, -3)}`))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Date range' })).toHaveValue('CUSTOM'))
    expect(screen.getByText(/· 4 days$/)).toBeInTheDocument()
  })

  it('falls back to the default range when the URL holds an invalid one', async () => {
    renderAt('/reports?from=2026-02-30&to=nope&tab=reservations')
    expect(await screen.findByRole('table', { name: 'Reservations arriving' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Date range' })).toHaveValue('LAST_30_DAYS')
    expect(rowsOf('Reservations arriving')).toHaveLength(25)
    expect(within(stat('Cancellation rate')).getByText('8%')).toBeInTheDocument()
  })

  it('reports occupancy with ADR, RevPAR and every room', async () => {
    renderAt('/reports?tab=occupancy')
    expect(await screen.findByRole('table', { name: 'Room performance' })).toBeInTheDocument()
    expect(within(stat('Occupancy')).getByText('4%')).toBeInTheDocument()
    expect(within(stat('Average daily rate')).getByText('₹7,258')).toBeInTheDocument()
    expect(rowsOf('Room performance')).toHaveLength(50)
    expect(rowsOf('Performance by room type')).toHaveLength(5)
    expect(screen.getByText(/are on the books/)).toBeInTheDocument()
  })

  it('lists guests by room revenue', async () => {
    renderAt('/reports?tab=guests')
    expect(await screen.findByRole('table', { name: 'Guest stays' })).toBeInTheDocument()
    expect(rowsOf('Guest stays')).toHaveLength(21)
    expect(rowsOf('Guest stays')[0]).toHaveTextContent('Omar Haddad')
  })

  it('exports the transactions on screen as CSV', async () => {
    let exported: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      exported = blob as Blob
      return 'blob:report'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderAt('/reports?tab=payments')
    await screen.findByRole('table', { name: 'Transactions' })
    await userEvent.click(screen.getByRole('button', { name: 'Export Transactions as CSV' }))

    const text = await exported!.text()
    const lines = text.replace(/^﻿/, '').trimEnd().split('\r\n')
    expect(lines[0]).toBe('Date,Payment,Guest,Invoice,Method,Status,Reference,Amount')
    expect(lines).toHaveLength(1 + 18)
    expect(await screen.findByText(/Exported 18 rows to transactions_/)).toBeInTheDocument()
  })
})
