'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Send, Plus } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'
import { useSelectedSeason } from '@/lib/contexts/season-context'

type Sender = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

type SentMessage = {
  id: string
  subject: string
  body: string
  sent_at: string
  email_sent_at: string | null
  recipient_count: number
  sender: Sender | Sender[] | null
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

function senderName(sender: Sender | Sender[] | null): string {
  const s = Array.isArray(sender) ? sender[0] : sender
  if (!s) return 'Unknown'
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email
}

export default function AdminMessagesPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`

  const selectedSeason = useSelectedSeason()
  const [sent, setSent] = useState<SentMessage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ clubSlug })
    if (selectedSeason?.id) params.set('seasonId', selectedSeason.id)
    const res = await fetch(`/api/messages/sent?${params}`)
    if (res.ok) {
      const data = await res.json()
      setSent(data.messages ?? [])
    }
    setLoading(false)
  }, [clubSlug, selectedSeason?.id])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <AdminPageHeader
          title="Messages"
          description="All messages sent to families in your club."
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
          <p className="text-xs text-zinc-600 mt-1">Compose a message to reach families across your programs.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-4 py-3 font-medium">Subject</th>
                <th className="text-left px-4 py-3 font-medium">Sent by</th>
                <th className="text-right px-4 py-3 font-medium">Families</th>
                <th className="text-right px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {sent.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`${basePath}/messages/${m.id}`}
                      className="font-medium text-foreground hover:text-orange-400 transition-colors"
                    >
                      {m.subject}
                    </Link>
                    <p className="text-xs text-zinc-600 mt-0.5 truncate max-w-sm">{m.body}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {senderName(m.sender)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">
                    {m.recipient_count}
                    {!m.email_sent_at && (
                      <span className="ml-1.5 text-xs text-yellow-600">·pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {formatRelativeTime(m.sent_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
