'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useParentClub } from '@/lib/use-parent-club'
import { CartProvider } from '@/lib/cart-context'
import { SeasonProvider } from '@/lib/contexts/season-context'
import { UnifiedSeasonSelector } from '@/components/unified-season-selector'
import { Button } from '@/components/ui/button'
import { ShoppingCart, LayoutDashboard, User, CreditCard } from 'lucide-react'
import { useCart } from '@/lib/cart-context'
import { ProfileMenu } from '@/components/profile-menu'

function ParentNav({
  clubSlug,
  profile,
}: {
  clubSlug: string
  profile: { id: string; email: string; first_name?: string | null; role: string }
}) {
  const router = useRouter()
  const { itemCount } = useCart()

  const navItems = [
    { label: 'Dashboard', href: `/clubs/${clubSlug}/parent/dashboard`, icon: LayoutDashboard },
    { label: 'Programs', href: `/clubs/${clubSlug}/parent/programs`, icon: LayoutDashboard },
    { label: 'Athletes', href: `/clubs/${clubSlug}/parent/athletes`, icon: User },
    { label: 'Billing', href: `/clubs/${clubSlug}/parent/billing`, icon: CreditCard },
  ]

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-6">
          <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
            <h1 className="text-xl font-semibold text-slate-900">Parent Portal</h1>
          </Link>
          <div className="flex gap-1">
            {navItems.map(item => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm">
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <UnifiedSeasonSelector />
          <Link href={`/clubs/${clubSlug}/parent/cart`}>
            <Button variant="outline" size="sm" className="relative">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Cart
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Button>
          </Link>
          <ProfileMenu profile={profile} />
        </div>
      </div>
    </nav>
  )
}

function ParentLayoutContent({
  children,
  clubSlug,
}: {
  children: React.ReactNode
  clubSlug: string
}) {
  const router = useRouter()
  const { profile, household, loading, error } = useParentClub()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error && !profile) {
    // Only show error if profile is missing - other errors will be handled below
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">Access Denied</h2>
          <p className="mt-2 text-sm text-red-700">
            {error || 'Profile not found. Please contact support.'}
          </p>
          <Button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="mt-4"
            variant="outline"
          >
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">Access Denied</h2>
          <p className="mt-2 text-sm text-red-700">
            Profile not found. Please contact support.
          </p>
          <Button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="mt-4"
            variant="outline"
          >
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  // If no household, show helpful message instead of blocking access
  // This can happen if signup didn't complete fully
  if (!household) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">Household Setup Required</h2>
          <p className="mt-2 text-sm text-yellow-700">
            Your account was created but your household information needs to be set up.
            This usually happens if signup didn't complete fully.
          </p>
          <p className="mt-4 text-sm text-yellow-700">
            Please contact support or try signing up again.
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
    <div className="min-h-screen bg-slate-50">
      <ParentNav clubSlug={clubSlug} profile={profile} />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
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
      <CartProvider>
        <ParentLayoutContent clubSlug={clubSlug}>{children}</ParentLayoutContent>
      </CartProvider>
    </SeasonProvider>
  )
}
