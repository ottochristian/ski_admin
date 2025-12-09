'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Profile } from '@/lib/types'
import { LayoutDashboard, Building2, Users, CreditCard } from 'lucide-react'

interface SystemAdminSidebarProps {
  profile: Profile
}

export function SystemAdminSidebar({ profile }: SystemAdminSidebarProps) {
  const pathname = usePathname()

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
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-4 flex-shrink-0 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">System Admin</h2>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        <div className="h-1 w-full mt-2 rounded bg-gradient-to-r from-purple-500 to-blue-500" />
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
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
    </aside>
  )
}
