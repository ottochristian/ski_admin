'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Sender = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

type Message = {
  id: string
  subject: string
  body: string
  sent_at: string
  read_at: string | null
  program_id: string | null
  sub_program_id: string | null
  group_id: string | null
  sender: Sender | Sender[] | null
  recipient_count?: number
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

export default function MessageDetailPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const messageId = params.messageId as string
  const basePath = `/clubs/${clubSlug}/coach`

  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Try inbox first, then sent
      const inboxRes = await fetch('/api/messages/inbox')
      if (inboxRes.ok) {
        const data = await inboxRes.json()
        const found = (data.messages ?? []).find((m: Message) => m.id === messageId)
        if (found) {
          setMessage(found)
          // Mark as read if not already
          if (!found.read_at) {
            await fetch(`/api/messages/${messageId}/read`, { method: 'PATCH' })
          }
          setLoading(false)
          return
        }
      }

      // Try sent
      const sentRes = await fetch(`/api/messages/sent?clubSlug=${clubSlug}`)
      if (sentRes.ok) {
        const data = await sentRes.json()
        const found = (data.messages ?? []).find((m: Message) => m.id === messageId)
        if (found) {
          setMessage(found)
          setLoading(false)
          return
        }
      }

      setError('Message not found.')
      setLoading(false)
    }

    load()
  }, [messageId, clubSlug])

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mx-auto" />
      </div>
    )
  }

  if (error || !message) {
    return (
      <div className="max-w-2xl">
        <Link href={`${basePath}/messages`} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to messages
        </Link>
        <p className="text-sm text-zinc-500">{error ?? 'Message not found.'}</p>
      </div>
    )
  }

  const s = getSender(message.sender)

  return (
    <div className="max-w-2xl">
      <Link
        href={`${basePath}/messages`}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to messages
      </Link>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800">
          <h1 className="text-lg font-semibold text-foreground">{message.subject}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-zinc-400">
            {s && (
              <>
                <span>{senderName(message.sender)}</span>
                <span className="text-zinc-700">·</span>
              </>
            )}
            {message.recipient_count !== undefined && (
              <>
                <span>
                  {message.recipient_count} {message.recipient_count === 1 ? 'family' : 'families'}
                </span>
                <span className="text-zinc-700">·</span>
              </>
            )}
            <span>
              {new Date(message.sent_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              at{' '}
              {new Date(message.sent_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{message.body}</p>
        </div>
      </div>
    </div>
  )
}
