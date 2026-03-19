'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Profile } from '@/lib/types'
import { LayoutDashboard, Users, Calendar, MessageSquare, Sparkles } from 'lucide-react'
import { useClub } from '@/lib/club-context'
import { colors } from '@/lib/colors'

interface CoachSidebarProps {
  profile: Profile
  clubSlug?: string
}

export function CoachSidebar({ profile, clubSlug }: CoachSidebarProps) {
  const pathname = usePathname()
  const { club, loading: clubLoading } = useClub()
  const [logoError, setLogoError] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const basePath = clubSlug ? `/clubs/${clubSlug}/coach` : '/coach'

  const menuItems = [
    { label: 'Dashboard', href: basePath, icon: LayoutDashboard },
    { label: 'Schedule', href: `${basePath}/schedule`, icon: Calendar },
    { label: 'Athletes', href: `${basePath}/athletes`, icon: Users },
    { label: 'AI Training Plan', href: `${basePath}/training-plan`, icon: Sparkles },
    { label: 'Messages', href: `${basePath}/messages`, icon: MessageSquare, badge: unreadCount },
  ]

  useEffect(() => {
    fetch('/api/messages/unread-count')
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.unread_count ?? 0))
      .catch(() => {})
  }, [pathname]) // Re-fetch when navigating (marks read clears badge)

  const initial = club?.name?.charAt(0).toUpperCase() || 'C'

  return (
    <aside className="w-64 bg-zinc-950 flex flex-col h-screen fixed left-0 top-0">
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
            (item.href !== basePath && pathname.startsWith(item.href))
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
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="bg-orange-600 text-white text-xs font-medium rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800 flex flex-col gap-2">
        <img src="/w110-logo-dark.svg" alt="W110" className="h-5 w-auto self-start" />
        <p className="text-zinc-600 text-xs">Coach Portal</p>
      </div>
    </aside>
  )
}
