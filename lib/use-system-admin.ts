'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './supabase/client'
import { Profile } from './types'
import { isRecoverySystemAdmin } from './system-admin-recovery'

/**
 * Hook for system admin pages that:
 * 1. Checks authentication
 * 2. Verifies system_admin role OR recovery email
 * 3. Returns profile for use in queries
 * 
 * RECOVERY MECHANISM: Emails in system-admin-recovery.ts always have access
 * This ensures you can never be locked out, even if your role is changed.
 */
export function useSystemAdmin() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function checkAuth() {
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

        // 2. Check if email is a recovery system admin (bypasses role check)
        const isRecovery = isRecoverySystemAdmin(user.email)

        // 3. Get profile
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

        // 4. Verify system_admin role OR recovery email
        const hasAccess = isRecovery || profileData?.role === 'system_admin'

        if (!hasAccess) {
          router.replace('/login')
          return
        }

        // If recovery email but role isn't system_admin, log a warning
        if (isRecovery && profileData?.role !== 'system_admin') {
          console.warn(
            `Recovery system admin access granted to ${user.email} (role: ${profileData?.role})`
          )
        }

        setProfile(profileData as Profile)
        setLoading(false)
      } catch (err) {
        console.error('useSystemAdmin error:', err)
        setError('An error occurred')
        setLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  return {
    profile,
    loading,
    error,
  }
}
