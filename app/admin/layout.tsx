'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { AdminSidebar } from '@/components/admin-sidebar'
import { Profile } from '@/lib/types'
import { useClub } from '@/lib/club-context'
import { getUserClub } from '@/lib/club-utils'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { club, loading: clubLoading } = useClub()
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      try {
        // Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.replace('/login')
          return
        }

        // Fetch profile and check if admin
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setError('Failed to load profile')
          setIsLoading(false)
          return
        }

        if (!profileData || profileData.role !== 'admin') {
          router.replace('/dashboard')
          return
        }

        setProfile(profileData as Profile)

        // Verify user has a club_id
        if (!profileData.club_id) {
          setError('No club associated with your account. Please contact an administrator.')
          setIsLoading(false)
          return
        }

        // Don't redirect - just use club context on existing routes
        // The club context will get the club from the profile
        setIsLoading(false)
      } catch (err) {
        console.error('Layout auth check error:', err)
        setError('An error occurred')
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, club, clubLoading])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">{error || 'Access denied'}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar profile={profile} />
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
