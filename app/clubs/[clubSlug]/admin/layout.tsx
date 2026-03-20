'use client'

import type React from 'react'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useRequireAdmin } from '@/lib/auth-context'
import { AdminSidebar } from '@/components/admin-sidebar'
import { UnifiedSeasonSelector } from '@/components/unified-season-selector'
import { ProfileMenu } from '@/components/profile-menu'
import { NotificationBell } from '@/components/notification-bell'
import { useClub } from '@/lib/club-context'
import { SeasonProvider } from '@/lib/contexts/season-context'
import { InlineLoading } from '@/components/ui/loading-states'
import { ErrorBoundary } from '@/components/error-boundary'
import { ImpersonationBanner } from '@/components/impersonation-banner'
import { useImpersonation } from '@/lib/use-impersonation'

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
  const impCtx = useImpersonation()

  // When impersonating, build a display profile with the impersonated user's identity
  const displayProfile = impCtx && profile
    ? {
        ...profile,
        first_name: impCtx.userName.split(' ')[0] || impCtx.userName,
        last_name: impCtx.userName.split(' ').slice(1).join(' ') || '',
        email: impCtx.userEmail,
      }
    : profile

  // Verify club slug matches user's club (if club loaded)
  useEffect(() => {
    if (!authLoading && !clubLoading && club && club.slug !== clubSlug) {
      // System admins can access any club - don't redirect
      if (profile?.role === 'system_admin') {
        return
      }
      // Also skip redirect when impersonating (imp cookie present)
      if (typeof document !== 'undefined' && /(?:^|;\s*)imp=/.test(document.cookie)) {
        return
      }

      // Club slug doesn't match - redirect to user's club
      router.replace(`/clubs/${club.slug}/admin`)
    }
  }, [club, clubSlug, authLoading, clubLoading, router, profile])

  // While auth is resolving (or briefly after a race before the auth listener fires),
  // show a full-screen loader rather than "Access denied".
  // useRequireAdmin already redirects non-admins to /login, so we never need to
  // display an access-denied message — the redirect handles it.
  if (authLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <SeasonProvider>
      <ImpersonationBanner />
      <div className="flex min-h-screen">
        <AdminSidebar profile={displayProfile!} clubSlug={clubSlug} />
        <main className="flex-1 ml-64 flex flex-col">
          <div className={`fixed right-0 left-64 border-b border-orange-800/40 bg-background/80 backdrop-blur-sm px-8 py-3 z-10 ${impCtx ? 'top-11' : 'top-0'}`}>
            <div className="flex items-center justify-end gap-4">
              {clubLoading ? (
                <div className="h-10 w-48 bg-zinc-800 animate-pulse rounded" />
              ) : (
                <>
                  <UnifiedSeasonSelector />
                  <NotificationBell
                    nudgesEndpoint="/api/admin/nudges"
                    draftEndpoint="/api/admin/nudges/draft"
                    clubSlug={clubSlug}
                    composeHref={`/clubs/${clubSlug}/admin/messages/compose`}
                  />
                  <ProfileMenu profile={displayProfile!} />
                </>
              )}
            </div>
          </div>
          <div className={`flex-1 overflow-auto ${impCtx ? 'pt-28' : 'pt-16'}`}>
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


