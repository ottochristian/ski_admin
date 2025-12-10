'use client'

import type React from 'react'
import { SystemAdminSidebar } from '@/components/system-admin-sidebar'
import { ProfileMenu } from '@/components/profile-menu'
import { useSystemAdmin } from '@/lib/use-system-admin'

export default function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, loading, error } = useSystemAdmin()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">{error || 'Access denied'}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <SystemAdminSidebar profile={profile} />
      <main className="flex-1 ml-64 flex flex-col bg-slate-50">
        <div className="fixed top-0 right-0 left-64 border-b border-slate-200 bg-white px-8 py-4 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">System Administration</h1>
            {profile && <ProfileMenu profile={profile} />}
          </div>
        </div>
        <div className="flex-1 overflow-auto pt-16">
          <div className="p-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
