'use client'

import type React from 'react'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useRequireCoach } from '@/lib/auth-context'
import { CoachSidebar } from '@/components/coach-sidebar'
import { UnifiedSeasonSelector } from '@/components/unified-season-selector'
import { ProfileMenu } from '@/components/profile-menu'
import { NotificationBell } from '@/components/notification-bell'
import { useClub } from '@/lib/club-context'
import { SeasonProvider } from '@/lib/contexts/season-context'
import { InlineLoading } from '@/components/ui/loading-states'
import { ErrorBoundary } from '@/components/error-boundary'

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const router = useRouter()
  const { profile, loading: authLoading } = useRequireCoach()
  const { club, loading: clubLoading } = useClub()

  // Verify club slug matches the coach's club
  useEffect(() => {
    if (!authLoading && !clubLoading && club && club.slug !== clubSlug) {
      router.replace(`/clubs/${club.slug}/coach`)
    }
  }, [club, clubSlug, authLoading, clubLoading, router])

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <SeasonProvider>
      <div className="flex min-h-screen">
        <CoachSidebar profile={profile} clubSlug={clubSlug} />
        <main className="flex-1 ml-64 flex flex-col">
          <div className="fixed top-0 right-0 left-64 border-b border-orange-800/40 bg-background/80 backdrop-blur-sm px-8 py-3 z-10">
            <div className="flex items-center justify-end gap-4">
              {clubLoading ? (
                <div className="h-10 w-48 bg-zinc-800 animate-pulse rounded" />
              ) : (
                <>
                  <UnifiedSeasonSelector />
                  <NotificationBell
                    nudgesEndpoint="/api/coach/nudges"
                    draftEndpoint="/api/coach/nudges/draft"
                    clubSlug={clubSlug}
                    composeHref={`/clubs/${clubSlug}/coach/messages/compose`}
                  />
                  <ProfileMenu profile={profile} />
                </>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto pt-16">
            <div className="p-8">
              <ErrorBoundary>
                {clubLoading ? <InlineLoading message="Loading..." /> : children}
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </SeasonProvider>
  )
}
