import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { demoData } from '@/api'
import { getDatabase, mutateDatabase, reloadDatabaseFromStorage } from '@/mock/db'
import { renderWithProviders } from '@/test/renderWithProviders'
import { DemoDataReset } from './DemoDataReset'

beforeEach(() => {
  localStorage.clear()
  reloadDatabaseFromStorage()
})

describe('DemoDataReset', () => {
  it('is available in mock mode', () => {
    expect(demoData).not.toBeNull()
  })

  it('restores the seed only after confirmation', async () => {
    mutateDatabase((db) => {
      db.reservations = db.reservations.slice(0, 1)
    })
    renderWithProviders(<DemoDataReset controls={demoData!} />)

    await userEvent.click(screen.getByRole('button', { name: 'Reset demo data' }))
    expect(screen.getByRole('dialog', { name: 'Reset demo data?' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getDatabase().reservations).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Reset demo data' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reset data' }))

    expect(await screen.findByText('Demo data restored')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(getDatabase().reservations).toHaveLength(40)
  })
})
