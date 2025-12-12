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
            // Stale time: data is considered fresh for 5 minutes
            // This prevents unnecessary refetches on navigation
            staleTime: 5 * 60 * 1000,
            // Cache time: unused data stays in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Don't refetch on window focus - reduces unnecessary requests
            refetchOnWindowFocus: false,
            // Don't refetch on mount if data is fresh - key performance fix!
            refetchOnMount: false,
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

