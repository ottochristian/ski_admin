'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Legacy dashboard route - redirects users to their appropriate club-aware dashboard
 * This page should not be accessed directly, but exists as a fallback redirect target
 */
export default function DashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    async function redirect() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        // Get profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, club_id')
          .eq('id', user.id)
          .single()

        if (!profile) {
          router.push('/login')
          return
        }

        // Get club slug
        const { data: club } = await supabase
          .from('clubs')
          .select('slug')
          .eq('id', profile.club_id)
          .single()

        if (!club) {
          router.push('/login')
          return
        }

        // Redirect to appropriate portal
        if (profile.role === 'system_admin') {
          router.push('/system-admin')
        } else if (profile.role === 'parent') {
          router.push(`/clubs/${club.slug}/parent/dashboard`)
        } else if (profile.role === 'coach') {
          router.push(`/clubs/${club.slug}/coach/dashboard`)
        } else if (profile.role === 'club_admin') {
          router.push(`/clubs/${club.slug}/admin`)
        } else {
          router.push('/login')
        }
      } catch (error) {
        console.error('Redirect error:', error)
        router.push('/login')
      }
    }
    redirect()
  }, [router, supabase])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}
