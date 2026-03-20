'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, LogOut, User, Building2 } from 'lucide-react'
import { ImpersonationContext } from '@/lib/impersonation'
import { IMP_SESSION_KEY } from '@/lib/use-impersonation'

export function ImpersonationBanner() {
  const router = useRouter()
  const [ctx, setCtx] = useState<ImpersonationContext | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Primary: sessionStorage
    const stored = sessionStorage.getItem(IMP_SESSION_KEY)
    if (stored) {
      try { setCtx(JSON.parse(stored)); return } catch {}
    }
    // Fallback: cookie
    const match = document.cookie.match(/(?:^|;\s*)imp=([^;]*)/)
    if (!match) { setCtx(null); return }
    try {
      setCtx(JSON.parse(decodeURIComponent(match[1])))
    } catch {
      setCtx(null)
    }
  }, [])

  if (!ctx) return null

  async function handleExit() {
    setExiting(true)
    sessionStorage.removeItem(IMP_SESSION_KEY)
    await fetch('/api/system-admin/impersonate', { method: 'DELETE', credentials: 'include' })
    router.push('/system-admin/users')
  }

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    coach: 'Coach',
    parent: 'Parent',
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-400 text-zinc-900 shadow-lg">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900/15">
            <Eye className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-3 min-w-0 flex-wrap text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 opacity-70" />
              {ctx.userName}
            </span>
            <span className="text-zinc-600">·</span>
            {ctx.clubName && (
              <>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 opacity-70" />
                  {ctx.clubName}
                </span>
                <span className="text-zinc-600">·</span>
              </>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-900/15 text-xs font-bold uppercase tracking-wide">
              {roleLabel[ctx.role] ?? ctx.role}
            </span>
          </div>
        </div>
        <button
          onClick={handleExit}
          disabled={exiting}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-amber-300 px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          {exiting ? 'Exiting…' : 'Exit impersonation'}
        </button>
      </div>
    </div>
  )
}
