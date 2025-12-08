'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const settingsTabs = [
    {
      label: 'Seasons',
      href: '/admin/settings/seasons',
      icon: Calendar,
    },
    {
      label: 'Branding',
      href: '/admin/settings/branding',
      icon: Palette,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
      {children}
    </div>
  )
}
