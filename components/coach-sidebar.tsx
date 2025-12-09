'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Profile } from '@/lib/types'
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClub } from '@/lib/club-context'

interface CoachSidebarProps {
  profile: Profile
}

export function CoachSidebar({ profile }: CoachSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { club, loading: clubLoading } = useClub()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/coach',
      icon: LayoutDashboard,
    },
    {
      label: 'Athletes',
      href: '/coach/athletes',
      icon: Users,
    },
    {
      label: 'Races',
      href: '/coach/races',
      icon: Calendar,
    },
    {
      label: 'Messages',
      href: '/coach/messages',
      icon: MessageSquare,
    },
  ]

  // Get primary color for personalization, default to blue
  const primaryColor = club?.primary_color || '#3B82F6'

  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4 flex flex-col h-screen">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900">Coach Portal</h2>
        {club && !clubLoading ? (
          <>
            <p
              className="text-sm font-medium mt-1"
              style={{ color: primaryColor }}
            >
              {club.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profile.email}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        )}
        {/* Color accent bar */}
        {club && !clubLoading && (
          <div
            className="h-1 w-full mt-2 rounded"
            style={{ backgroundColor: primaryColor }}
          />
        )}
      </div>

      <nav className="space-y-1 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== '/coach' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'font-medium'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              style={
                isActive && club
                  ? {
                      backgroundColor: `${primaryColor}15`,
                      color: primaryColor,
                    }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto">
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:bg-red-50 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}
