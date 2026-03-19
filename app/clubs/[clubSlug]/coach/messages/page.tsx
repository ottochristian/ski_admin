'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, Plus, Circle } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'

type Sender = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

type InboxMessage = {
  id: string
  subject: string
  body: string
  sent_at: string
  read_at: string | null
  program_id: string | null
  sub_program_id: string | null
  group_id: string | null
  sender: Sender | Sender[] | null
}

type SentMessage = {
  id: string
  subject: string
  body: string
  sent_at: string
  email_sent_at: string | null
  program_id: string | null
  sub_program_id: string | null
  group_id: string | null
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

function getSender(sender: Sender | Sender[] | null): Sender | null {
  if (!sender) return null
  return Array.isArray(sender) ? sender[0] : sender
}

function senderName(sender: Sender | Sender[] | null): string {
  const s = getSender(sender)
  if (!s) return 'Unknown'
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email
}

export default function CoachMessagesPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/coach`

  const [supabase] = useState(() => createClient())
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [inbox, setInbox] = useState<InboxMessage[]>([])
  const [sent, setSent] = useState<SentMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadInbox = useCallback(async () => {
    const res = await fetch('/api/messages/inbox')
    if (res.ok) {
      const data = await res.json()
      setInbox(data.messages ?? [])
      setUnreadCount(data.unread_count ?? 0)
    }
  }, [])

  const loadSent = useCallback(async () => {
    const res = await fetch(`/api/messages/sent?clubSlug=${clubSlug}`)
    if (res.ok) {
      const data = await res.json()
      setSent(data.messages ?? [])
    }
  }, [clubSlug])

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([loadInbox(), loadSent()])
      setLoading(false)
    }
    load()
  }, [loadInbox, loadSent])

  async function markRead(messageId: string) {
    await fetch(`/api/messages/${messageId}/read`, { method: 'PATCH' })
    setInbox((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, read_at: new Date().toISOString() } : m))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <AdminPageHeader
          title="Messages"
          description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        />
        <Link
          href={`${basePath}/messages/compose`}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Compose
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-zinc-800">
        <button
          onClick={() => setTab('inbox')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'inbox'
              ? 'border-orange-500 text-foreground'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Inbox
          {unreadCount > 0 && (
            <span className="ml-2 bg-orange-600 text-white text-xs rounded-full px-1.5 py-0.5">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'sent'
              ? 'border-orange-500 text-foreground'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Sent
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mx-auto" />
        </div>
      ) : tab === 'inbox' ? (
        inbox.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No messages yet" subtitle="Messages from your club will appear here." />
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
            {inbox.map((m) => (
              <li key={m.id}>
                <Link
                  href={`${basePath}/messages/${m.id}`}
                  onClick={() => !m.read_at && markRead(m.id)}
                  className="flex items-start gap-3 px-4 py-4 hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="mt-1 flex-shrink-0 w-2">
                    {!m.read_at && (
                      <span className="block h-2 w-2 rounded-full bg-orange-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${!m.read_at ? 'font-semibold text-foreground' : 'text-zinc-300'}`}>
                        {m.subject}
                      </p>
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {formatRelativeTime(m.sent_at)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{senderName(m.sender)}</p>
                    <p className="text-xs text-zinc-600 mt-0.5 truncate">{m.body}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        sent.length === 0 ? (
          <EmptyState icon={Send} title="No sent messages" subtitle="Messages you send to families will appear here." />
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
            {sent.map((m) => (
              <li key={m.id}>
                <Link
                  href={`${basePath}/messages/${m.id}`}
                  className="flex items-start gap-3 px-4 py-4 hover:bg-zinc-800/40 transition-colors"
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
                      {m.email_sent_at ? ' · emailed' : ' · email pending'}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5 truncate">{m.body}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
}) {
  return (
    <div className="py-16 text-center">
      <Icon className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="text-xs text-zinc-600 mt-1">{subtitle}</p>
    </div>
  )
}
