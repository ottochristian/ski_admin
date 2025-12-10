'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, ReactNode } from 'react'
import { AuthProvider } from './auth-context'

/**
 * Providers wrapper that includes all necessary context providers
 * - React Query for data fetching
 * - Auth context for authentication
 */
export function Providers({ children }: { children: ReactNode }) {
  // Create QueryClient with stable instance (using useState to avoid recreating on re-render)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: data is considered fresh for 30 seconds
            staleTime: 30 * 1000,
            // Cache time: unused data stays in cache for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Refetch on window focus (useful for keeping data fresh)
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
