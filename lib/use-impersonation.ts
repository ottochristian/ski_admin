'use client'

import { useEffect, useState } from 'react'
import type { ImpersonationContext } from './impersonation'

export const IMP_SESSION_KEY = 'imp_ctx'

/** Client-side hook: returns the active ImpersonationContext (or null if not impersonating) */
export function useImpersonation(): ImpersonationContext | null {
  const [ctx, setCtx] = useState<ImpersonationContext | null>(null)
  useEffect(() => {
    // Primary: sessionStorage (set by handleImpersonate before navigation)
    const stored = sessionStorage.getItem(IMP_SESSION_KEY)
    if (stored) {
      try {
        setCtx(JSON.parse(stored))
        return
      } catch {}
    }
    // Fallback: read imp cookie directly
    const match = document.cookie.match(/(?:^|;\s*)imp=([^;]*)/)
    if (!match) return
    try {
      setCtx(JSON.parse(decodeURIComponent(match[1])))
    } catch {}
  }, [])
  return ctx
}
