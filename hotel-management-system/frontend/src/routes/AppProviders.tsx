import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import { demoData } from '@/api'
import { sessionStore } from '@/auth/session'
import { createQueryClient } from './queryClient'

/** App-wide providers: TanStack Query cache (reset when the signed-in user changes) and toast notifications. */
export function AppProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient())

  // Mock mode: when another tab changes the demo data, refresh everything on screen.
  useEffect(() => demoData?.subscribe(() => void queryClient.invalidateQueries()), [queryClient])

  // Whenever the user changes (sign-in, sign-out, expiry), drop every cached response:
  // the next user must never see data fetched with someone else's permissions.
  useEffect(() => sessionStore.subscribe(() => queryClient.clear()), [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className: '!text-sm !font-medium !shadow-card',
        }}
      />
    </QueryClientProvider>
  )
}
