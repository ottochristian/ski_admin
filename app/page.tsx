'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Snowflake, Trophy, Users } from "lucide-react"
import { supabase } from '@/lib/supabaseClient'

export default function HomePage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        // Check if user is logged in
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

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
        if (profile.role === 'admin') {
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
            const { data: club } = await supabase
              .from('clubs')
              .select('slug')
              .eq('id', profile.club_id)
              .single()

            if (club?.slug) {
              router.push(`/clubs/${club.slug}/parent/dashboard`)
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
        setCheckingAuth(false)
      }
    }

    checkAuthAndRedirect()
  }, [router])

  // Show loading state while checking auth
  if (checkingAuth) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <Snowflake className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show landing page for unauthenticated users
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Snowflake className="h-6 w-6" />
            <span className="text-lg font-semibold">Ski Club Admin</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-balance">
              Welcome to Ski Club Management
            </h1>
            <p className="mt-6 text-lg text-muted-foreground text-balance">
              Register your athletes, manage programs, and track registrations all in one place.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Parent Portal</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/50">
          <div className="container mx-auto px-4 py-16">
            <div className="grid gap-8 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <Users className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Easy Registration</CardTitle>
                  <CardDescription>
                    Register multiple athletes and manage their information in one place
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Trophy className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Program Management</CardTitle>
                  <CardDescription>Browse available programs and enroll your athletes with ease</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Snowflake className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Secure Payments</CardTitle>
                  <CardDescription>Pay for registrations securely with Stripe integration</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">© 2025 Ski Club Admin. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
