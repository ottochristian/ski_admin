'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Profile } from '@/lib/types'
import { LayoutDashboard, Building2, Users, CreditCard, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SystemAdminSidebarProps {
  profile: Profile
}

export function SystemAdminSidebar({ profile }: SystemAdminSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/system-admin',
      icon: LayoutDashboard,
    },
    {
      label: 'Clubs',
      href: '/system-admin/clubs',
      icon: Building2,
    },
    {
      label: 'Club Admins',
      href: '/system-admin/admins',
      icon: Users,
    },
    {
      label: 'Subscriptions',
      href: '/system-admin/subscriptions',
      icon: CreditCard,
    },
  ]

  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900">System Admin</h2>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        <div className="h-1 w-full mt-2 rounded bg-gradient-to-r from-purple-500 to-blue-500" />
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/system-admin' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'font-medium bg-purple-50 text-purple-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Button
        onClick={handleSignOut}
        variant="ghost"
        className="mt-8 w-full justify-start gap-3 text-destructive hover:bg-red-50 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </aside>
  )
}
