'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

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
        console.log('[LOGIN] Session check already running, skipping duplicate')
        return
      }
      sessionCheckRef.current = true
      
      try {
        // Add timeout to prevent hanging (10s to match auth context)
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 10000)
        )
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any

        
        if (!session) {
          setCheckingSession(false)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setCheckingSession(false)
          return
        }

        // Get user profile for role and club info
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, club_id')
          .eq('id', user.id)
          .single()

        if (profileError || !profileData) {
          setCheckingSession(false)
          return
        }

        // Redirect based on role
        if (profileData.role === 'system_admin') {
          router.push('/system-admin')
          return
        }

        if (profileData.role === 'admin' && profileData.club_id) {
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

        if (profileData.role === 'coach') {
          router.push('/coach')
          return
        }

        if (profileData.role === 'parent' && profileData.club_id) {
          const { data: club } = await supabase
            .from('clubs')
            .select('slug')
            .eq('id', profileData.club_id)
            .single()

          if (club?.slug) {
            router.push(`/clubs/${club.slug}/parent/dashboard`)
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

      if (profileData.role === 'admin' && profileData.club_id) {
        const { data: club } = await supabase
          .from('clubs')
          .select('slug')
          .eq('id', profileData.club_id)
          .single()

        if (club?.slug) {
          router.push(`/clubs/${club.slug}/admin`)
        } else {
          router.push('/admin')
        }
        return
      }

      if (profileData.role === 'coach') {
        router.push('/coach')
        return
      }

      if (profileData.role === 'parent' && profileData.club_id) {
        const { data: club } = await supabase
          .from('clubs')
          .select('slug')
          .eq('id', profileData.club_id)
          .single()

        if (club?.slug) {
          router.push(`/clubs/${club.slug}/parent/dashboard`)
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

  // While we're checking if a session exists, show a tiny loading state
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
