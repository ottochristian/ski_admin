'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Profile } from '@/lib/types'
import { LayoutDashboard, BookOpen, FileText, Users, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClub } from '@/lib/club-context'

interface AdminSidebarProps {
  profile: Profile
}

export function AdminSidebar({ profile }: AdminSidebarProps) {
  const router = useRouter()
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

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

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
    <aside className="w-64 border-r border-slate-200 bg-white p-4 flex flex-col h-screen">
      <div className="mb-8">
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

      <nav className="space-y-1 flex-1">
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

      <div className="mt-auto space-y-4">
        {/* Club Logo in lower left corner */}
        {club && !clubLoading && (
          <div className="flex justify-start relative">
            {club.logo_url ? (
              <>
                <img
                  src={club.logo_url}
                  alt={`${club.name} logo`}
                  className="h-16 w-16 rounded-md object-cover border border-slate-200"
                  onError={(e) => {
                    console.error('Failed to load club logo:', club.logo_url)
                    // Hide image and show fallback
                    e.currentTarget.style.display = 'none'
                    const fallback = document.getElementById(`club-logo-fallback-${club.id}`)
                    if (fallback) {
                      fallback.style.display = 'flex'
                    }
                  }}
                />
                {/* Fallback: Show club initial if logo fails to load */}
                <div
                  id={`club-logo-fallback-${club.id}`}
                  className="h-16 w-16 rounded-md border border-slate-200 hidden items-center justify-center text-2xl font-semibold"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor,
                  }}
                >
                  {club.name.charAt(0).toUpperCase()}
                </div>
              </>
            ) : (
              /* Show club initial if no logo */
              <div
                className="h-16 w-16 rounded-md border border-slate-200 flex items-center justify-center text-2xl font-semibold"
                style={{
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                }}
              >
                {club.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
        
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
