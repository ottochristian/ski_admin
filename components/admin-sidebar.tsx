'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Profile } from '@/lib/types'
import { LayoutDashboard, BookOpen, FileText, Users, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AdminSidebarProps {
  profile: Profile
}

export function AdminSidebar({ profile }: AdminSidebarProps) {
  const router = useRouter()

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
  ]

  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900">Admin Portal</h2>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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
