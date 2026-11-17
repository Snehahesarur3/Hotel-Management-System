import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function setup(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      open
      title="Cancel reservation?"
      message="The room will be released."
      confirmLabel="Cancel reservation"
      tone="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('renders an accessible modal dialog with focus inside', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Cancel reservation?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('confirms and cancels through the buttons', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel reservation' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('closes on Escape', async () => {
    const { onCancel } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cannot be dismissed while the action is running', async () => {
    const { onCancel, onConfirm } = setup({ loading: true })
    await userEvent.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel reservation' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
