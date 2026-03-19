'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Snowflake, Trophy, Users } from "lucide-react"
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        // First check if we have a session (localStorage only, no network call)
        // Add timeout wrapper for getSession
        try {
          const sessionPromise = supabase.auth.getSession()
          const sessionTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getSession timeout')), 3000)
          )
          
          const sessionData = await Promise.race([sessionPromise, sessionTimeoutPromise]) as Awaited<typeof sessionPromise>
          const { data: { session } } = sessionData

          if (!session) {
            // No session - show landing page
            setCheckingAuth(false)
            return
          }
        } catch (sessionError: unknown) {
          const sessionMessage = sessionError instanceof Error ? sessionError.message : String(sessionError)
          if (sessionMessage === 'getSession timeout') {
            setCheckingAuth(false)
            return
          }
          // Other errors - continue to try getUser
        }

        // Check if user is logged in (with timeout)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth check timeout')), 3000)
        )
        
        const authPromise = supabase.auth.getUser()
        
        let userData
        try {
          userData = await Promise.race([authPromise, timeoutPromise]) as Awaited<typeof authPromise>
        } catch (raceError: unknown) {
          const raceMessage = raceError instanceof Error ? raceError.message : String(raceError)
          if (raceMessage === 'Auth check timeout') {
            setCheckingAuth(false)
            return
          }
          throw raceError
        }

        const {
          data: { user },
          error: userError,
        } = userData

        if (userError || !user) {
          // No user logged in - show landing page
          setCheckingAuth(false)
          return
        }

        // User is logged in - get their profile to determine role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, club_id')
          .eq('id', user.id)
          .single()

        if (profileError || !profile) {
          // Profile not found - show landing page
          setCheckingAuth(false)
          return
        }

        // Redirect based on role
        if (profile.role === 'system_admin') {
          router.push('/system-admin')
          return
        }

        if (profile.role === 'admin') {
          // Get club slug for club-aware route
          if (profile.club_id) {
            const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(profile.club_id)}`)
            const json = await resp.json()

            if (resp.ok && json?.club?.slug) {
              router.push(`/clubs/${json.club.slug}/admin`)
              return
            }
          }
          // Fallback to legacy route if no club
          router.push('/admin')
          return
        }

        if (profile.role === 'coach') {
          router.push('/coach')
          return
        }

        if (profile.role === 'parent') {
          // Get club slug for parent portal
          if (profile.club_id) {
            const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(profile.club_id)}`)
            const json = await resp.json()

            if (resp.ok && json?.club?.slug) {
              router.push(`/clubs/${json.club.slug}/parent/dashboard`)
              return
            }
          }
          // Fallback if no club found - show error instead of old dashboard
          console.error('Parent user has no club_id associated')
          setCheckingAuth(false)
          return
        }

        // Unknown role - show landing page
        setCheckingAuth(false)
      } catch (err) {
        console.error('Error checking auth:', err)
        // On error (including timeout), show landing page
        setCheckingAuth(false)
      }
    }

    checkAuthAndRedirect()
  }, [router])

  if (checkingAuth) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">Checking your session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground relative">
      {/* Topo background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <img src="/topo-bg.svg" alt="" className="w-full h-full object-cover opacity-[0.055]" />
      </div>

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <img src="/w110-logo-dark.svg" alt="W110" className="h-6 w-auto" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-foreground transition-colors px-3 py-1.5">
              Log in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative flex min-h-svh flex-col items-center justify-center px-6 pt-16 text-center">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[600px] w-[600px] rounded-full bg-orange-600/10 blur-[120px]" />
          </div>

          <div className="relative max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-600/30 bg-orange-600/10 px-4 py-1.5 text-xs font-medium text-orange-400">
              Ski club management, reimagined
            </div>

            <h1 className="text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl text-balance leading-[1.05]">
              Run your club.<br />
              <span className="text-orange-500">Not spreadsheets.</span>
            </h1>

            <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto text-balance">
              Registrations, payments, athlete management, AI-powered coaching tools — everything your ski program needs in one platform.
            </p>

            <div className="mt-10 flex justify-center">
              <Link
                href="/signup/new-club"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-foreground font-semibold px-8 py-3 text-sm transition-colors"
              >
                Set up your club
              </Link>
            </div>
            <p className="mt-5 text-sm text-zinc-500">
              Already a member?{' '}
              <Link href="/login" className="text-zinc-400 hover:text-foreground underline underline-offset-2 transition-colors">Sign in</Link>
              {' · '}
              <Link href="/signup" className="text-zinc-400 hover:text-foreground underline underline-offset-2 transition-colors">Create a parent account</Link>
            </p>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
            <div className="h-6 w-px bg-gradient-to-b from-zinc-600 to-transparent mx-auto" />
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-zinc-800 py-24 px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-16">
              Everything your program needs
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: 'Athlete & Family Management',
                  desc: 'Households, guardians, athletes, waivers — all linked together. No more chasing paperwork.',
                },
                {
                  icon: Trophy,
                  title: 'Programs & Registration',
                  desc: 'Build programs, set pricing, open registration. Parents enroll and pay in minutes.',
                },
                {
                  icon: Snowflake,
                  title: 'AI Coaching Tools',
                  desc: 'Generate weekly training plans, daily briefings, and scheduling insights powered by Claude AI.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="mb-4 inline-flex rounded-lg bg-orange-600/10 p-2.5">
                    <Icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="border-t border-zinc-800 py-20 px-6 text-center">
          <div className="mx-auto max-w-xl">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-zinc-400 mb-8 text-sm">Set up your club in minutes. No credit card required.</p>
            <Link
              href="/signup/new-club"
              className="inline-flex items-center justify-center rounded-lg bg-orange-600 hover:bg-orange-500 text-foreground font-semibold px-8 py-3 text-sm transition-colors"
            >
              Set up your club
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/w110-logo-dark.svg" alt="W110" className="h-5 w-auto opacity-60" />
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} West 110. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
