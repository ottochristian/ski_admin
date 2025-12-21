'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useRequireAdmin } from '@/lib/auth-context'
import { AdminSidebar } from '@/components/admin-sidebar'
import { UnifiedSeasonSelector } from '@/components/unified-season-selector'
import { ProfileMenu } from '@/components/profile-menu'
import { useClub } from '@/lib/club-context'
import { SeasonProvider } from '@/lib/contexts/season-context'
import { InlineLoading } from '@/components/ui/loading-states'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const router = useRouter()
  const { profile, loading: authLoading } = useRequireAdmin()
  const { club, loading: clubLoading } = useClub()

  // Verify club slug matches user's club (if club loaded)
  useEffect(() => {
    if (!authLoading && !clubLoading && club && club.slug !== clubSlug) {
      // System admins can access any club - don't redirect
      if (profile?.role === 'system_admin') {
        return
      }
      
      // Club slug doesn't match - redirect to user's club
      router.replace(`/clubs/${club.slug}/admin`)
    }
  }, [club, clubSlug, authLoading, clubLoading, router, profile])

  // Non-blocking approach: Show layout structure immediately with conditional content
  // This prevents the entire app from being stuck on a loading screen
  if (!authLoading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">Access denied</p>
      </div>
    )
  }

  return (
    <SeasonProvider>
      <div className="flex min-h-screen">
        {profile && <AdminSidebar profile={profile} clubSlug={clubSlug} />}
        <main className={`flex-1 ${profile ? 'ml-64' : ''} flex flex-col bg-slate-50`}>
          <div className={`fixed top-0 right-0 ${profile ? 'left-64' : 'left-0'} border-b border-slate-200 bg-white px-8 py-4 z-10`}>
            <div className="flex items-center justify-end gap-4">
              {(authLoading || clubLoading) ? (
                <div className="h-10 w-48 bg-slate-200 animate-pulse rounded" />
              ) : (
                <>
                  <UnifiedSeasonSelector />
                  {profile && <ProfileMenu profile={profile} />}
                </>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto pt-16">
            <div className="p-8">
              {(authLoading || clubLoading) ? (
                <InlineLoading message="Loading..." />
              ) : (
                children
              )}
            </div>
          </div>
        </main>
      </div>
    </SeasonProvider>
  )
}


