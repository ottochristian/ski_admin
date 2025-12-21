'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const msg = urlParams.get('message')
      const confirmed = urlParams.get('confirmed')
      if (msg) {
        setMessage(decodeURIComponent(msg))
      }
      if (confirmed === 'true') {
        setMessage('Email confirmed! You can now log in.')
      }
    }
  }, [])

  // 🔍 On mount, see if we already have a logged-in user
  // If logged in, redirect to appropriate dashboard
  useEffect(() => {
    async function checkUserAndRedirect() {
      try {
        // First, verify Supabase client is initialized
        if (!supabase) {
          console.error('Supabase client not initialized')
          setError('Application configuration error. Please refresh the page.')
          setCheckingSession(false)
          return
        }

        // Check if environment variables are configured
        if (!isSupabaseConfigured()) {
          console.error('Supabase environment variables not configured')
          setError('Application configuration error: Supabase credentials are missing. Please check your .env.local file.')
          setCheckingSession(false)
          return
        }

        console.log('Checking session...')
        
        // Try to get session from localStorage first (faster, doesn't require network)
        // This helps avoid timeout if there's no existing session
        try {
          // Add timeout wrapper for getSession too
          const sessionPromise = supabase.auth.getSession()
          const sessionTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getSession timeout')), 5000)
          )
          
          const sessionData = await Promise.race([sessionPromise, sessionTimeoutPromise]) as any
          const { data: { session: localSession } } = sessionData
          
          // If no local session, skip getUser() call and show login form
          if (!localSession) {
            console.log('No local session found, showing login form')
            setCheckingSession(false)
            return
          }
        } catch (sessionError: any) {
          if (sessionError.message === 'getSession timeout') {
            console.log('getSession timed out - showing login form')
            setCheckingSession(false)
            return
          }
          console.log('Error checking local session, will try getUser()', sessionError)
          // Continue to getUser() below
        }
        
        // Add a timeout wrapper for the getUser call specifically
        // Increased timeout to 10 seconds to account for network latency
        const getUserPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getUser timeout')), 10000)
        )

        let userData
        try {
          userData = await Promise.race([getUserPromise, timeoutPromise]) as any
        } catch (raceError: any) {
          if (raceError.message === 'getUser timeout') {
            console.error('getUser() call timed out after 10 seconds')
            console.error('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
            console.error('This might indicate:', 
              '- Network connectivity issues',
              '- Supabase service is unavailable',
              '- Firewall or CORS blocking the request',
              '- Invalid Supabase URL'
            )
            // If getUser times out, just show login form - user can still log in
            console.log('Timeout detected, showing login form anyway')
            setCheckingSession(false)
            // Don't set error - just let them try to log in
            return
          }
          throw raceError
        }

        const {
          data: { user },
          error: userError,
        } = userData

        if (userError || !user) {
          // No user logged in - show login form
          console.log('No user logged in')
          setCheckingSession(false)
          return
        }

        // User is logged in - get profile and redirect appropriately
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, club_id')
          .eq('id', user.id)
          .single()

        if (profileError || !profileData) {
          // Profile not found - allow login (might be new account)
          console.log('Profile error or not found:', profileError)
          setCheckingSession(false)
          return
        }

        // Redirect based on role
        if (profileData.role === 'system_admin') {
          router.push('/system-admin')
          return
        }

        if (profileData.role === 'admin') {
          // Get club slug for club-aware route
          if (profileData.club_id) {
            const { data: club, error: clubError } = await supabase
              .from('clubs')
              .select('slug')
              .eq('id', profileData.club_id)
              .single()

            if (clubError) {
              console.error('Club fetch error:', clubError)
              setError('Error loading club information. Please try again.')
              setCheckingSession(false)
              return
            }

            if (club?.slug) {
              router.push(`/clubs/${club.slug}/admin`)
              return
            }
          }
          // Fallback to legacy route if no club
          router.push('/admin')
          return
        }

        if (profileData.role === 'coach') {
          router.push('/coach')
          return
        }

        if (profileData.role === 'parent') {
          // Parents must have a club_id
          if (!profileData.club_id) {
            // Show error message instead of redirecting
            setError('Your account is missing club assignment. Please contact support.')
            setCheckingSession(false)
            return
          }

          // Get club slug for redirect
          const { data: club, error: clubError } = await supabase
            .from('clubs')
            .select('slug')
            .eq('id', profileData.club_id)
            .single()

          if (clubError) {
            console.error('Club fetch error:', clubError)
            setError('Error loading club information. Please try again.')
            setCheckingSession(false)
            return
          }

          if (club?.slug) {
            router.push(`/clubs/${club.slug}/parent/dashboard`)
            return
          } else {
            setError('Club not found. Please contact support.')
            setCheckingSession(false)
            return
          }
        }

        // Unknown role - allow login
        setCheckingSession(false)
      } catch (error) {
        // Catch any unexpected errors
        console.error('Session check error:', error)
        setCheckingSession(false)
        setError('An error occurred. Please try refreshing the page.')
      }
    }

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.error('Session check timed out - allowing login anyway')
      setCheckingSession(false)
      // Don't set error - just let them log in normally
      // This is common when redirected from password setup
    }, 8000) // 8 second timeout

    checkUserAndRedirect().finally(() => {
      clearTimeout(timeout)
    })
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // If login successful, ensure profile exists and create it with signup data if needed
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single()

      // If no profile exists, create one using data from signup_data table or user metadata
      if (!profile) {
        // Try to get signup data from temporary table first
        const { data: signupData } = await supabase
          .from('signup_data')
          .select('*')
          .eq('user_id', authData.user.id)
          .single()

        // Fallback to user metadata if signup_data table doesn't exist
        const userMetadata = authData.user.user_metadata || {}
        const isProfilePending = userMetadata.profile_pending === true || signupData !== null

        // Use signup_data if available, otherwise use metadata
        const firstName = signupData?.first_name || userMetadata.first_name || null
        const lastName = signupData?.last_name || userMetadata.last_name || null
        const clubId = signupData?.club_id || userMetadata.club_id || null

        // Get default club if needed
        let finalClubId = clubId
        if (!finalClubId) {
          const { data: defaultClub } = await supabase
            .from('clubs')
            .select('id')
            .eq('slug', 'default')
            .single()
          finalClubId = defaultClub?.id || null
        }

        // Create profile with signup form data
        const { error: profileError } = await supabase.rpc('create_user_profile', {
          p_user_id: authData.user.id,
          p_email: authData.user.email || email,
          p_first_name: firstName,
          p_last_name: lastName,
          p_role: 'parent',
          p_club_id: finalClubId,
        })

        // If profile was created and we have household data, create household too
        if (!profileError && isProfilePending && finalClubId) {
          // Use signup_data if available, otherwise use metadata
          const { data: householdData } = await supabase
            .from('households')
            .insert([
              {
                club_id: finalClubId,
                primary_email: authData.user.email || email,
                phone: signupData?.phone || userMetadata.phone || null,
                address_line1: signupData?.address_line1 || userMetadata.address_line1 || null,
                address_line2: signupData?.address_line2 || userMetadata.address_line2 || null,
                city: signupData?.city || userMetadata.city || null,
                state: signupData?.state || userMetadata.state || null,
                zip_code: signupData?.zip_code || userMetadata.zip_code || null,
                emergency_contact_name: signupData?.emergency_contact_name || userMetadata.emergency_contact_name || null,
                emergency_contact_phone: signupData?.emergency_contact_phone || userMetadata.emergency_contact_phone || null,
              },
            ])
            .select()
            .single()

          // Link user to household
          if (householdData) {
            await supabase.from('household_guardians').insert([
              {
                household_id: householdData.id,
                user_id: authData.user.id,
                is_primary: true,
              },
            ])

            // Delete signup_data now that we've used it
            if (signupData) {
              await supabase.from('signup_data').delete().eq('id', signupData.id)
            }

            // Clear the pending flag
            await supabase.auth.updateUser({
              data: { profile_pending: false },
            })
          }
        }
      }
    }

    setLoading(false)

    // ✅ login success → redirect based on role and club
    // Get profile to determine redirect
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role, club_id')
      .eq('id', authData.user.id)
      .single()

    if (profileData) {
      if (profileData.role === 'system_admin') {
        router.push('/system-admin')
        return
      } else if (profileData.role === 'admin') {
        // Get club slug for club-aware route
        if (profileData.club_id) {
          const { data: club } = await supabase
            .from('clubs')
            .select('slug')
            .eq('id', profileData.club_id)
            .single()

          if (club?.slug) {
            router.push(`/clubs/${club.slug}/admin`)
            return
          }
        }
        // Fallback to legacy route if no club
        router.push('/admin')
        return
      } else if (profileData.role === 'coach') {
        router.push('/coach')
        return
      } else if (profileData.role === 'parent') {
        // Parents MUST have a club_id - enforce this
        if (!profileData.club_id) {
          setError('Your account is missing club assignment. Please contact support.')
          setLoading(false)
          return
        }

        // Get club slug for redirect
        const { data: club } = await supabase
          .from('clubs')
          .select('slug')
          .eq('id', profileData.club_id)
          .single()

        if (club?.slug) {
          router.push(`/clubs/${club.slug}/parent/dashboard`)
          return
        } else {
          setError('Club not found. Please contact support.')
          setLoading(false)
          return
        }
      }
    }

    // Fallback - if we can't determine role, show error
    setError('Unable to determine your account type. Please contact support.')
    setLoading(false)
  }

  // While we’re checking if a session exists, show a tiny loading state
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-muted-foreground text-sm">Checking your session…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <h1 className="mb-4 text-xl font-semibold text-slate-100">
          Log in
        </h1>

        {message && (
          <div className="mb-4 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-400">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground">
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-sky-400 disabled:opacity-60"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          <p className="text-center text-sm text-slate-400">
            <Link href="/forgot-password" className="text-sky-400 hover:text-sky-300">
              Forgot your password?
            </Link>
          </p>
          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link href="/signup" className="text-sky-400 hover:text-sky-300">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
