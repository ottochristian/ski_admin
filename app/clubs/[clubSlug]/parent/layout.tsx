'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useParentClub } from '@/lib/use-parent-club'
import { CartProvider } from '@/lib/cart-context'
import { Button } from '@/components/ui/button'
import { ShoppingCart, LogOut, LayoutDashboard, User, CreditCard } from 'lucide-react'
import { useCart } from '@/lib/cart-context'

function ParentNav({ clubSlug }: { clubSlug: string }) {
  const router = useRouter()
  const { itemCount } = useCart()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

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
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
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
  const { profile, household, loading, error } = useParentClub()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || !profile || !household) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">Access Denied</h2>
          <p className="mt-2 text-sm text-red-700">
            {error || 'No household found. Please contact support.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ParentNav clubSlug={clubSlug} />
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
    <CartProvider>
      <ParentLayoutContent clubSlug={clubSlug}>{children}</ParentLayoutContent>
    </CartProvider>
  )
}
