'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

/** Prevent open-redirect attacks: only allow relative paths to known app routes */
function isSafeRedirect(url: string): boolean {
  if (!url.startsWith('/')) return false // block absolute URLs / protocol-relative
  const allowed = ['/clubs/', '/admin', '/coach', '/parent', '/system-admin', '/accept-guardian-invitation']
  return allowed.some(prefix => url.startsWith(prefix))
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())
  const sessionCheckRef = useRef(false) // Prevent duplicate session checks

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

  // Check if user is already logged in and redirect appropriately
  useEffect(() => {
    async function checkUserAndRedirect() {
      // Prevent duplicate calls (React 18 strict mode runs useEffect twice)
      if (sessionCheckRef.current) {
        return
      }
      sessionCheckRef.current = true
      
      try {
        // Check for redirect parameter
        const urlParams = new URLSearchParams(window.location.search)
        const redirectTo = urlParams.get('redirect')

        // Add timeout to prevent hanging (10s to match auth context)
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 10000)
        )
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as Awaited<typeof sessionPromise>

        
        if (!session) {
          setCheckingSession(false)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setCheckingSession(false)
          return
        }

        // If there's a redirect parameter, validate it's a safe relative path (prevent open redirect)
        if (redirectTo && isSafeRedirect(redirectTo)) {
          router.push(redirectTo)
          return
        }

        // Get user profile for role and club info
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, club_id')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError || !profileData) {
          setCheckingSession(false)
          return
        }

        // Redirect based on role
        if (profileData.role === 'system_admin') {
          router.push('/system-admin')
          return
        }

        let clubIdToUse = profileData.club_id

        // Parent: reconcile club_id with household club (if mismatch)
        if (profileData.role === 'parent') {
          const { data: householdGuardian, error: householdError } = await supabase
            .from('household_guardians')
            .select('household_id, households!inner(club_id)')
            .eq('user_id', user.id)
            .maybeSingle()

          const householdsData = householdGuardian?.households as { club_id: string } | { club_id: string }[] | null
          const householdClubId = Array.isArray(householdsData)
            ? householdsData?.[0]?.club_id
            : householdsData?.club_id

          if (householdClubId && householdClubId !== clubIdToUse) {
            clubIdToUse = householdClubId
            // Attempt to fix profile club_id to match household
            const { error: profileUpdateError } = await supabase
              .from('profiles')
              .update({ club_id: householdClubId })
              .eq('id', user.id)

          }
        }

        if (profileData.role === 'admin' && clubIdToUse) {
          const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(clubIdToUse)}`)
          const json = await resp.json()

          if (resp.ok && json?.club?.slug) {
            router.push(`/clubs/${json.club.slug}/admin`)
            return
          }
        }

        if (profileData.role === 'coach' && clubIdToUse) {
          const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(clubIdToUse)}`)
          const json = await resp.json()

          if (resp.ok && json?.club?.slug) {
            router.push(`/clubs/${json.club.slug}/coach`)
            return
          }
        }

        if (profileData.role === 'parent' && clubIdToUse) {
          const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(clubIdToUse)}`)
          const json = await resp.json()

          if (resp.ok && json?.club?.slug) {
            router.push(`/clubs/${json.club.slug}/parent/dashboard`)
            return
          }
        }

        setCheckingSession(false)
      } catch (error) {
        console.error('Session check error:', error)
        setCheckingSession(false)
      } finally {
        // Reset the ref so it can run again if needed
        sessionCheckRef.current = false
      }
    }

    checkUserAndRedirect()
  }, [router, supabase])

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success the browser navigates away — no need to setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('Login failed. Please try again.')
        setLoading(false)
        return
      }

      // Check for redirect parameter (for invitation acceptance, etc.)
      const urlParams = new URLSearchParams(window.location.search)
      const redirectTo = urlParams.get('redirect')

      if (redirectTo && isSafeRedirect(redirectTo)) {
        router.push(redirectTo)
        return
      }

      // Get user profile for role-based redirect
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, club_id')
        .eq('id', authData.user.id)
        .single()

      if (profileError || !profileData) {
        setError('Could not load user profile. Please try again.')
        setLoading(false)
        return
      }

      // Redirect based on role
      if (profileData.role === 'system_admin') {
        router.push('/system-admin')
        return
      }

      let clubIdToUse = profileData.club_id

      // Parent: reconcile club_id with household club (if mismatch)
      if (profileData.role === 'parent') {
        const { data: householdGuardian, error: householdError } = await supabase
          .from('household_guardians')
          .select('household_id, households!inner(club_id)')
          .eq('user_id', authData.user.id)
          .maybeSingle()

        const householdsData2 = householdGuardian?.households as { club_id: string } | { club_id: string }[] | null
        const householdClubId = Array.isArray(householdsData2)
          ? householdsData2?.[0]?.club_id
          : householdsData2?.club_id

        if (householdClubId && householdClubId !== clubIdToUse) {
          clubIdToUse = householdClubId
          // Attempt to fix profile club_id to match household
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ club_id: householdClubId })
            .eq('id', authData.user.id)

        }
      }

      if (profileData.role === 'admin' && clubIdToUse) {
        const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(clubIdToUse)}`)
        const json = await resp.json()

        if (resp.ok && json?.club?.slug) {
          router.push(`/clubs/${json.club.slug}/admin`)
        } else {
          router.push('/admin')
        }
        return
      }

      if (profileData.role === 'coach' && clubIdToUse) {
        const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(clubIdToUse)}`)
        const json = await resp.json()

        if (resp.ok && json?.club?.slug) {
          router.push(`/clubs/${json.club.slug}/coach`)
        } else {
          setError('Club not found. Please contact support.')
          setLoading(false)
        }
        return
      }

      if (profileData.role === 'parent' && clubIdToUse) {
        const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(clubIdToUse)}`)
        const json = await resp.json()

        if (resp.ok && json?.club?.slug) {
          router.push(`/clubs/${json.club.slug}/parent/dashboard`)
        } else {
          setError('Club not found. Please contact support.')
          setLoading(false)
        }
        return
      }

      // Unknown role
      setError('Unknown user role. Please contact support.')
      setLoading(false)
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">Checking your session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background relative">
      {/* Topo background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <img src="/topo-bg.svg" alt="" className="w-full h-full object-cover opacity-[0.055]" />
      </div>
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-zinc-800 relative overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-end justify-start">
          <div className="h-[400px] w-[400px] rounded-full bg-orange-600/10 blur-[100px] -translate-x-1/4 translate-y-1/4" />
        </div>

        <div className="relative">
          <Link href="/"><img src="/w110-logo-dark.svg" alt="W110" className="h-8 w-auto" /></Link>
        </div>

        <div className="relative">
          <p className="text-3xl font-bold text-foreground leading-snug tracking-tight">
            Run your club.<br />
            <span className="text-orange-500">Not spreadsheets.</span>
          </p>
          <p className="mt-4 text-zinc-500 text-sm leading-relaxed max-w-xs">
            Registrations, athlete management, waivers, payments, and AI-powered coaching tools — built for the way clubs actually operate.
          </p>
        </div>

        <p className="relative text-zinc-700 text-xs">© {new Date().getFullYear()} West 110</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
            <Link href="/"><img src="/w110-logo-dark.svg" alt="W110" className="h-8 w-auto" /></Link>
          </div>

          <h1 className="page-title text-foreground">Welcome back</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Sign in to your account to continue.</p>

          {message && (
            <div className="mt-6 rounded-lg border border-green-800 bg-green-900/30 px-4 py-3 text-sm text-green-400">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-zinc-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-orange-500 hover:text-orange-400">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:text-foreground focus:outline-none disabled:opacity-60 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58Z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <Link href="/signup" className="text-orange-500 hover:text-orange-400 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
