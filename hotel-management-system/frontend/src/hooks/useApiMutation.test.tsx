import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/types/api'
import { useApiMutation } from './useApiMutation'

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
  return { wrapper, invalidate }
}

describe('useApiMutation', () => {
  it('invalidates the given queries and shows a success toast', async () => {
    const { wrapper, invalidate } = setup()
    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: async (name: string) => ({ name }),
          successMessage: (data) => `Saved ${data.name}`,
          invalidate: [['rooms'], ['dashboard']],
        }),
      { wrapper },
    )
    act(() => result.current.mutate('Room 101'))
    expect(await screen.findByText('Saved Room 101')).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['rooms'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })

  it('shows the API error message, unless the caller handles it', async () => {
    const { wrapper } = setup()
    const failing = async () => {
      throw new ApiError(409, 'Room 101 is already booked for these dates')
    }
    const { result } = renderHook(() => useApiMutation({ mutationFn: failing }), { wrapper })
    act(() => result.current.mutate())
    expect(await screen.findByText('Room 101 is already booked for these dates')).toBeInTheDocument()

    const onError = vi.fn(() => true)
    const handled = renderHook(() => useApiMutation({ mutationFn: async () => { throw new ApiError(400, 'Inline only') }, onError }), { wrapper })
    act(() => handled.result.current.mutate())
    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(screen.queryByText('Inline only')).not.toBeInTheDocument()
  })
})
