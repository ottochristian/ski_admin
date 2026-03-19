'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, Loader2, AlertCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { storeNudgeContext } from '@/lib/nudge-context-store'

interface Nudge {
  id: string
  type: string
  severity: 'red' | 'amber'
  title: string
  detail: string
  send_target: { type: 'program' | 'sub_program' | 'group'; id: string; name: string } | null
  recipient_count: number | null
  household_ids?: string[]
  preview_names: string[]
}

interface NotificationBellProps {
  nudgesEndpoint: string
  draftEndpoint: string
  clubSlug: string
  composeHref: string
}

export function NotificationBell({
  nudgesEndpoint,
  draftEndpoint,
  clubSlug,
  composeHref,
}: NotificationBellProps) {
  const router = useRouter()
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [drafting, setDrafting] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(nudgesEndpoint)
      .then(r => r.json())
      .then(d => setNudges(d.nudges ?? []))
      .catch(() => {})
  }, [nudgesEndpoint])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const visible = nudges.filter(n => !dismissed.has(n.id))
  const hasRed = visible.some(n => n.severity === 'red')
  const count = visible.length

  if (count === 0) return null

  function handleDraft(nudge: Nudge) {
    const payload = {
      nudgeType: nudge.type,
      title: nudge.title,
      detail: nudge.detail,
      target_name: nudge.send_target?.name ?? '',
      target: nudge.send_target,
      household_ids: nudge.household_ids ?? [],
      recipient_count: nudge.recipient_count,
      preview_names: nudge.preview_names,
      draft_endpoint: draftEndpoint,
    }
    storeNudgeContext(payload)
    setOpen(false)
    router.push(composeHref)
  }

  function dismiss(id: string) {
    setDismissed(prev => new Set([...prev, id]))
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        aria-label={`${count} notification${count !== 1 ? 's' : ''}`}
      >
        <Bell className={cn('h-5 w-5', open ? 'text-zinc-200' : 'text-zinc-400')} />
        <span className={cn(
          'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1',
          hasRed ? 'bg-red-500' : 'bg-orange-500',
          hasRed && 'animate-pulse'
        )}>
          {count}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              {count} Nudge{count !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-zinc-800 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-zinc-500" />
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-800/60">
            {visible.map((nudge) => (
              <div key={nudge.id} className="px-4 py-3 flex gap-3 items-start hover:bg-zinc-800/30 transition-colors">
                {nudge.severity === 'red'
                  ? <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{nudge.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{nudge.detail}</p>
                  {nudge.preview_names.length > 0 && (
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {nudge.preview_names.join(', ')}
                      {nudge.recipient_count != null && nudge.recipient_count > nudge.preview_names.length
                        ? ` +${nudge.recipient_count - nudge.preview_names.length} more`
                        : ''}
                    </p>
                  )}
                  {nudge.send_target && (
                    <button
                      onClick={() => handleDraft(nudge)}
                      disabled={drafting === nudge.id}
                      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 disabled:opacity-50 transition-colors"
                    >
                      {drafting === nudge.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <span className="text-[10px]">✉</span>
                      }
                      {drafting === nudge.id ? 'Drafting…' : 'Draft & Send'}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismiss(nudge.id)}
                  className="p-1 rounded hover:bg-zinc-800 transition-colors flex-shrink-0"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5 text-zinc-600 hover:text-zinc-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
