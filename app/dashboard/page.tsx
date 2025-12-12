'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/**
 * Legacy dashboard route - redirects users to their appropriate club-aware dashboard
 * This page should not be accessed directly, but exists as a fallback redirect target
 */
export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      // Get profile to determine role and club
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, club_id')
        .eq('id', user.id)
        .single()

      if (!profileData) {
        router.push('/login')
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
      }

      if (profileData.role === 'coach') {
        router.push('/coach')
        return
      }

      if (profileData.role === 'parent') {
        // Parents MUST have a club_id
        if (!profileData.club_id) {
          // This shouldn't happen, but handle it gracefully
          router.push('/login?error=no_club')
          return
        }

        // Get club slug
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

      // Unknown role or error - go to login
      router.push('/login')
    }

    redirect()
  }, [router])

  // Show loading while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}
