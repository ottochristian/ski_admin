/**
 * Client-side Supabase client with SSR support.
 * Use this in Client Components for browser-based operations.
 * 
 * @example
 * 'use client'
 * import { createBrowserSupabaseClient } from '@/lib/supabase-client'
 * 
 * const supabase = createBrowserSupabaseClient()
 * const { data } = await supabase.from('profiles').select('*')
 */

'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Legacy export for backward compatibility.
 * Consider migrating to createBrowserSupabaseClient() for better SSR support.
 * @deprecated Use createBrowserSupabaseClient() instead
 */
export const supabase = createBrowserSupabaseClient()



