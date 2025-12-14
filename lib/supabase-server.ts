import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

/**
 * Creates a server-side Supabase client with proper session management.
 * Use this in Server Components, Server Actions, and API Routes.
 * 
 * @example
 * const supabase = await createServerSupabaseClient()
 * const { data } = await supabase.from('profiles').select('*')
 */
export async function createServerSupabaseClient(request?: NextRequest) {
  // If request is provided (API route), use request cookies
  // Otherwise use next/headers cookies (Server Components/Actions)
  if (request) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            // Get all cookies from the request
            const allCookies: { name: string; value: string }[] = []
            // request.cookies is a ReadonlyRequestCookies
            request.cookies.getAll().forEach((cookie: { name: string; value: string }) => {
              allCookies.push({ name: cookie.name, value: cookie.value })
            })
            return allCookies
          },
          setAll(cookiesToSet) {
            // In API routes, we can't set cookies directly on the response here
            // This is handled by the middleware or response headers
            // But we need to implement this for SSR compatibility
          },
        },
      }
    )
  }

  // Default behavior for Server Components/Actions
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase admin client using the service role key.
 * Use this ONLY in API routes for admin operations (e.g., user creation).
 * DO NOT use this in client components or expose it to the client.
 * 
 * @example
 * const supabaseAdmin = createSupabaseAdminClient()
 * await supabaseAdmin.auth.admin.inviteUserByEmail(email)
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase configuration. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    )
  }

  // Use createClient directly for admin operations (not createServerClient)
  // This bypasses cookie handling since we're using service role key
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(supabaseUrl, serviceRoleKey)
}



