'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClub } from '@/lib/club-context'
import { colors } from '@/lib/colors'
import { useCart } from '@/lib/cart-context'
import { LayoutDashboard, BookOpen, User, CreditCard, ShoppingCart, Calendar } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface ParentSidebarProps {
  profile: Profile
  clubSlug: string
}

export function ParentSidebar({ profile, clubSlug }: ParentSidebarProps) {
  const pathname = usePathname()
  const { club, loading: clubLoading } = useClub()
  const { itemCount } = useCart()
  const [logoError, setLogoError] = useState(false)

  const basePath = `/clubs/${clubSlug}/parent`

  const menuItems = [
    { label: 'Dashboard', href: `${basePath}/dashboard`, icon: LayoutDashboard },
    { label: 'Programs', href: `${basePath}/programs`, icon: BookOpen },
    { label: 'Athletes', href: `${basePath}/athletes`, icon: User },
    { label: 'Schedule', href: `${basePath}/schedule`, icon: Calendar },
    { label: 'Billing', href: `${basePath}/billing`, icon: CreditCard },
  ]

  const initial = club?.name?.charAt(0).toUpperCase() || 'S'

  return (
    <aside className="hidden md:flex w-64 bg-zinc-950 flex-col h-screen fixed left-0 top-0">
      {/* Header — club identity */}
      <div className="px-5 py-5 flex-shrink-0 border-b border-zinc-800">
        {/* Club logo + name */}
        {club && !clubLoading ? (
          <div className="flex items-center gap-3">
            {club.logo_url && !logoError ? (
              <img
                src={club.logo_url}
                alt={club.name}
                className="w-9 h-9 rounded-lg object-cover flex-shrink-0 ring-1 ring-zinc-700"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ring-zinc-700 text-sm font-semibold text-foreground"
                style={{ backgroundColor: club.primary_color || colors.primary }}
              >
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-foreground text-sm font-semibold truncate">{club.name}</p>
              <p className="text-zinc-500 text-xs truncate">{profile.email}</p>
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 text-xs truncate">{profile.email}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(item.href) && item.href !== basePath)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-foreground font-medium'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {/* Cart — shown when items present */}
        <Link
          href={`${basePath}/cart`}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname.startsWith(`${basePath}/cart`)
              ? 'bg-zinc-800 text-foreground font-medium'
              : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
          }`}
        >
          <ShoppingCart className="h-4 w-4 shrink-0" />
          Cart
          {itemCount > 0 && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-foreground">
              {itemCount}
            </span>
          )}
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800 flex flex-col gap-2">
        <img src="/w110-logo-dark.svg" alt="W110" className="h-5 w-auto self-start" />
        <p className="text-zinc-600 text-xs">Parent Portal</p>
      </div>
    </aside>
  )
}
