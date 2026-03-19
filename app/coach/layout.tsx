'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Legacy coach layout — redirects to the club-scoped coach portal.
 * All coach routes now live at /clubs/[clubSlug]/coach/...
 */
export default function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, club_id')
        .eq('id', user.id)
        .single()

      if (!profileData || profileData.role !== 'coach') {
        router.replace('/login')
        return
      }

      if (profileData.club_id) {
        const resp = await fetch(`/api/clubs/public?id=${encodeURIComponent(profileData.club_id)}`)
        const json = await resp.json()
        if (resp.ok && json?.club?.slug) {
          router.replace(`/clubs/${json.club.slug}/coach`)
          return
        }
      }

      router.replace('/login')
    }

    redirect()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
    </div>
  )
}
