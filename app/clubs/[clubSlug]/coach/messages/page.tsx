'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Send, Plus } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'

type SentMessage = {
  id: string
  subject: string
  body: string
  sent_at: string
  email_sent_at: string | null
  recipient_count: number
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CoachMessagesPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/coach`

  const [sent, setSent] = useState<SentMessage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/messages/sent?clubSlug=${clubSlug}`)
    if (res.ok) {
      const data = await res.json()
      setSent(data.messages ?? [])
    }
    setLoading(false)
  }, [clubSlug])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <AdminPageHeader
          title="Messages"
          description="Messages you've sent to families."
        />
        <Link
          href={`${basePath}/messages/compose`}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Compose
        </Link>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mx-auto" />
        </div>
      ) : sent.length === 0 ? (
        <div className="py-16 text-center">
          <Send className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-400">No messages sent yet</p>
          <p className="text-xs text-zinc-600 mt-1">Compose a message to reach families in your programs.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
          {sent.map((m) => (
            <li key={m.id}>
              <Link
                href={`${basePath}/messages/${m.id}`}
                className="flex items-start gap-4 px-4 py-4 hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{m.subject}</p>
                    <span className="text-xs text-zinc-500 flex-shrink-0">
                      {formatRelativeTime(m.sent_at)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {m.recipient_count} {m.recipient_count === 1 ? 'family' : 'families'}
                    {' · '}
                    {m.email_sent_at ? 'emailed' : 'email pending'}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5 truncate">{m.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
