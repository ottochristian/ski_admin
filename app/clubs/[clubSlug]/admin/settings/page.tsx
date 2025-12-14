'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Palette } from 'lucide-react'
import { useRequireAdmin } from '@/lib/auth-context'
import { InlineLoading } from '@/components/ui/loading-states'

export default function SettingsPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, loading: authLoading } = useRequireAdmin()
  const basePath = `/clubs/${clubSlug}/admin`

  if (authLoading) {
    return <InlineLoading message="Loading…" />
  }

  if (!profile) {
    return null
  }

  const settingsOptions = [
    {
      title: 'Seasons',
      description: 'Manage program seasons and periods',
      href: `${basePath}/settings/seasons`,
      icon: Calendar,
    },
    {
      title: 'Club Branding',
      description: 'Customize your club logo and colors',
      href: `${basePath}/settings/branding`,
      icon: Palette,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your club's configuration and preferences
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsOptions.map((option) => {
          const Icon = option.icon
          return (
            <Link key={option.href} href={option.href}>
              <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{option.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {option.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

