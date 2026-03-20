'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  email_sent_at: string | null
  recipient_count: number
  sender: Sender | Sender[] | null
}

function senderName(sender: Sender | Sender[] | null): string {
  const s = Array.isArray(sender) ? sender[0] : sender
  if (!s) return 'Unknown'
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email
}

export default function AdminMessageDetailPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const messageId = params.messageId as string
  const basePath = `/clubs/${clubSlug}/admin`

  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/messages/sent?clubSlug=${clubSlug}`)
      if (res.ok) {
        const data = await res.json()
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
        <div className="px-6 py-5 border-b border-zinc-800">
          <h1 className="text-lg font-semibold text-foreground">{message.subject}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-zinc-400">
            <span>{senderName(message.sender)}</span>
            <span className="text-zinc-700">·</span>
            <span>
              {message.recipient_count} {message.recipient_count === 1 ? 'recipient' : 'recipients'}
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              {new Date(message.sent_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}{' '}
              at{' '}
              {new Date(message.sent_at).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit',
              })}
            </span>
            {message.email_sent_at ? (
              <span className="text-zinc-600">· emailed</span>
            ) : (
              <span className="text-yellow-600">· email pending</span>
            )}
          </div>
        </div>
        <div className="px-6 py-5">
          {/<[a-z][\s\S]*>/i.test(message.body) ? (
            <div
              className="text-sm text-zinc-300 leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_a]:text-orange-400 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: message.body }}
            />
          ) : (
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{message.body}</p>
          )}
        </div>
      </div>
    </div>
  )
}
