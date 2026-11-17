import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SearchInput } from './SearchInput'

/** Parent that commits the reported search after a delay, like a URL update on a busy page. */
function SlowParent({ onCommit, echoDelayMs }: { onCommit: (v: string) => void; echoDelayMs: number }) {
  const [value, setValue] = useState('')
  return (
    <>
      <SearchInput
        label="Search"
        value={value}
        onSearch={(v) =>
          setTimeout(() => {
            onCommit(v)
            setValue(v)
          }, echoDelayMs)
        }
      />
      <button type="button" onClick={() => setValue('')}>
        external clear
      </button>
    </>
  )
}

const sleep = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)))

describe('SearchInput', () => {
  it('reports the text once typing pauses', async () => {
    const onCommit = vi.fn()
    render(<SlowParent onCommit={onCommit} echoDelayMs={0} />)
    await userEvent.type(screen.getByRole('searchbox'), 'suite')
    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith('suite'))
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('keeps what the user typed while an earlier search is being committed', async () => {
    const onCommit = vi.fn()
    render(<SlowParent onCommit={onCommit} echoDelayMs={200} />)
    const box = screen.getByRole('searchbox')

    await userEvent.type(box, 'z')
    await sleep(350) // debounce fires and reports "z"; the echo arrives 200 ms later…
    await userEvent.type(box, 'y') // …while the user keeps typing
    await sleep(250)

    expect(box).toHaveValue('zy')
    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith('zy'))
  })

  it('follows external changes such as clearing filters', async () => {
    render(<SlowParent onCommit={() => {}} echoDelayMs={0} />)
    const box = screen.getByRole('searchbox')
    await userEvent.type(box, 'deluxe')
    await waitFor(() => expect(box).toHaveValue('deluxe'))
    await sleep(400)
    await userEvent.click(screen.getByRole('button', { name: 'external clear' }))
    expect(box).toHaveValue('')
  })
})
