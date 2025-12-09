'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Profile } from '@/lib/types'
import { LayoutDashboard, BookOpen, FileText, Users, Settings } from 'lucide-react'
import { useClub } from '@/lib/club-context'

interface AdminSidebarProps {
  profile: Profile
}

export function AdminSidebar({ profile }: AdminSidebarProps) {
  const pathname = usePathname()
  const { club, loading: clubLoading } = useClub()

  // Debug: Log club data to verify logo_url is loaded
  useEffect(() => {
    if (club && !clubLoading) {
      console.log('AdminSidebar - Club data:', {
        name: club.name,
        logo_url: club.logo_url,
        hasLogo: !!club.logo_url,
      })
    }
  }, [club, clubLoading])

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
    },
    {
      label: 'Programs',
      href: '/admin/programs',
      icon: BookOpen,
    },
    {
      label: 'Registrations',
      href: '/admin/registrations',
      icon: FileText,
    },
    {
      label: 'Reports',
      href: '/admin/reports',
      icon: LayoutDashboard,
    },
    {
      label: 'Athletes',
      href: '/admin/athletes',
      icon: Users,
    },
    {
      label: 'Coaches',
      href: '/admin/coaches',
      icon: Users,
    },
    {
      label: 'Settings',
      href: '/admin/settings/seasons',
      icon: Settings,
    },
  ]

  // Get primary color for personalization, default to blue
  const primaryColor = club?.primary_color || '#3B82F6'
  
  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-4 flex-shrink-0 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Admin Portal</h2>
        {club && !clubLoading ? (
          <>
            <p 
              className="text-sm font-medium mt-1"
              style={{ color: primaryColor }}
            >
              {club.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{profile.email}</p>
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

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
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
    </aside>
  )
}
