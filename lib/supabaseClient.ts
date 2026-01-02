import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Log warnings if env vars are missing (but don't throw - let the app handle it)
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Missing Supabase environment variables!')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗')
  console.error('The app will use placeholder values and may fail to connect.')
}

// Only create client if we have valid env vars
// If not, create with placeholders but log a warning
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'supabase.auth.token',
      flowType: 'implicit' // More reliable than pkce for localhost
    },
  }
)

// Create ephemeral client for login operations (no session persistence)
// This avoids hanging issues with Safari and token refresh
export const createEphemeralClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured')
  }
  
  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: undefined
      }
    }
  )
}

// Export a helper to check if client is properly configured
export const isSupabaseConfigured = () => {
  return !!(
    supabaseUrl && 
    supabaseAnonKey &&
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey !== 'placeholder-key'
  )
}