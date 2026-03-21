'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useParentClub } from '@/lib/use-parent-club'
import { CartProvider } from '@/lib/cart-context'
import { SeasonProvider } from '@/lib/contexts/season-context'
import { UnifiedSeasonSelector } from '@/components/unified-season-selector'
import { ParentSidebar } from '@/components/parent-sidebar'
import { ProfileMenu } from '@/components/profile-menu'
import { Button } from '@/components/ui/button'
import { InlineLoading } from '@/components/ui/loading-states'
import { ImpersonationBanner } from '@/components/impersonation-banner'
import { useImpersonation } from '@/lib/use-impersonation'

function ParentLayoutContent({
  children,
  clubSlug,
}: {
  children: React.ReactNode
  clubSlug: string
}) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const { profile, household, loading, error } = useParentClub()
  const impersonation = useImpersonation()

  useEffect(() => {
    if (loading) return
    if (!profile) {
      router.replace('/login')
    } else if (!household && profile.role !== 'system_admin' && !impersonation) {
      // System admins and impersonation sessions have no household — skip redirect
      router.replace('/signup')
    }
  }, [loading, profile, household, router, impersonation])

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <InlineLoading message="Loading..." />
      </div>
    )
  }

  if (!household && !impersonation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">Finishing your setup…</h2>
          <p className="mt-2 text-sm text-yellow-700">
            Redirecting you to complete your account setup.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/signup')
              }}
              variant="outline"
            >
              Sign Out & Sign Up Again
            </Button>
            <Button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              variant="outline"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <ParentSidebar profile={profile} clubSlug={clubSlug} />
      <main className="flex-1 ml-64 flex flex-col">
        <div className="fixed top-0 right-0 left-64 border-b border-orange-800/40 bg-background/80 backdrop-blur-sm px-8 py-3 z-10">
          <div className="flex items-center justify-end gap-4">
            <UnifiedSeasonSelector />
            <ProfileMenu profile={profile} />
          </div>
        </div>
        <div className="flex-1 overflow-auto pt-16">
          <div className="p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const clubSlug = params.clubSlug as string

  return (
    <SeasonProvider>
      <ImpersonationBanner />
      <CartProvider>
        <ParentLayoutContent clubSlug={clubSlug}>{children}</ParentLayoutContent>
      </CartProvider>
    </SeasonProvider>
  )
}
