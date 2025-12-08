'use client'

import type React from 'react'
import { SystemAdminSidebar } from '@/components/system-admin-sidebar'
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
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b border-slate-200 bg-white px-8 py-4">
          <h1 className="text-2xl font-semibold text-slate-900">System Administration</h1>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
