'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './supabase/client'
import { useClub } from './club-context'
import { Profile } from './types'

/**
 * Standard hook for admin pages that:
 * 1. Checks authentication
 * 2. Verifies admin role
 * 3. Gets club_id from profile or context
 * 4. Returns profile and clubId for use in queries
 */
export function useAdminClub() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const { club } = useClub()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clubId, setClubId] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuthAndGetClub() {
      try {
        setLoading(true)
        setError(null)

        // 1. Check authentication
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.replace('/login')
          return
        }

        // 2. Get profile and verify admin
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setError('Failed to load profile')
          setLoading(false)
          return
        }

        if (!profileData || profileData.role !== 'admin') {
          router.replace('/login')
          return
        }

        setProfile(profileData as Profile)

        // 3. Get club_id from context or profile
        const resolvedClubId = club?.id || profileData.club_id

        if (!resolvedClubId) {
          setError('No club associated with your account. Please contact an administrator.')
          setLoading(false)
          return
        }

        setClubId(resolvedClubId)
        setLoading(false)
      } catch (err) {
        console.error('useAdminClub error:', err)
        setError('An error occurred')
        setLoading(false)
      }
    }

    checkAuthAndGetClub()
  }, [router, club, supabase])

  return {
    profile,
    clubId,
    loading,
    error,
  }
}

