'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardHeroChatProps {
  firstName: string
  chatEndpoint: string
}

const CHIPS = [
  { label: 'Revenue summary', q: 'What is our total revenue this season so far?' },
  { label: 'Missing waivers', q: 'Which athletes are missing required waivers?' },
  { label: "Who hasn't paid?", q: 'Which athletes have unpaid or pending registrations?' },
  { label: 'Churn risk', q: "Which families registered last season but haven't signed up yet this season?" },
  { label: 'Program fill rates', q: 'Which programs are nearly full and how many spots remain?' },
]

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[2]) {
      // **bold** — bright white, no color tint
      parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic text-zinc-300">{match[3]}</em>)
    } else if (match[4]) {
      // `code` — neutral pill, no orange
      parts.push(
        <code key={match.index} className="bg-zinc-700/80 text-zinc-200 px-1.5 py-0.5 rounded text-[11px] font-mono">
          {match[4]}
        </code>
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderContent(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1" />
    if (/^#{1,2} /.test(line)) {
      return <p key={i} className="font-semibold text-white mt-3 first:mt-0">{renderInline(line.replace(/^#{1,2} /, ''))}</p>
    }
    if (/^### /.test(line)) {
      return <p key={i} className="font-medium text-zinc-200 mt-2">{renderInline(line.replace(/^### /, ''))}</p>
    }
    if (/^[*-] /.test(line)) {
      return (
        <div key={i} className="flex gap-2">
          <span className="text-zinc-500 shrink-0 mt-0.5">•</span>
          <span>{renderInline(line.replace(/^[*-] /, ''))}</span>
        </div>
      )
    }
    if (/^> /.test(line)) {
      return (
        <div key={i} className="border-l-2 border-zinc-600 pl-3 text-zinc-400 italic">
          {renderInline(line.replace(/^> /, ''))}
        </div>
      )
    }
    return <p key={i}>{renderInline(line)}</p>
  })
}

export function DashboardHeroChat({ firstName, chatEndpoint }: DashboardHeroChatProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

  // Scroll message container to bottom when messages update
  useEffect(() => {
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    const nextMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...messages,
      { role: 'user', content: userMsg },
    ]
    setMessages(nextMessages)
    setLoading(true)
    try {
      const res = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages([...nextMessages, { role: 'assistant', content: data.message }])
    } catch {
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      {/* Greeting */}
      <div className="flex items-center gap-4">
        <Sparkles className="h-9 w-9 text-orange-500 shrink-0" />
        <h1 className="text-4xl font-semibold text-foreground tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Unified orange-bordered container — matches Club Intelligence widget */}
        <div className="relative rounded-xl border border-orange-900/40 bg-zinc-900 overflow-hidden shadow-[0_0_50px_-15px_var(--glow-orange,rgba(249,115,22,0.15))]">
          {/* Top shimmer line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

          {/* Scrollable message thread */}
          {messages.length > 0 && (
            <div
              ref={scrollContainerRef}
              className="overflow-y-auto max-h-[55vh] flex flex-col gap-5 p-5 border-b border-orange-900/30"
            >
              {messages.map((msg, i) =>
                msg.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] bg-zinc-800 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed" style={{ color: '#e4e4e7' }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3 items-start">
                    <Sparkles className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-zinc-300 leading-relaxed space-y-1 flex-1">
                      {renderContent(msg.content)}
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex gap-3 items-center">
                  <Sparkles className="h-4 w-4 text-orange-500 shrink-0 animate-pulse" />
                  <span className="text-sm text-zinc-500">Thinking…</span>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="How can I help you today?"
            rows={3}
            disabled={loading}
            style={{ color: '#e4e4e7' }}
            className="w-full bg-transparent px-5 py-4 pr-16 text-sm placeholder:text-zinc-600 focus:outline-none resize-none"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={cn(
              'absolute right-3 bottom-3 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
              input.trim() && !loading
                ? 'bg-orange-600 hover:bg-orange-500 cursor-pointer'
                : 'bg-zinc-700 cursor-not-allowed'
            )}
          >
            <ArrowUp className={cn('h-4 w-4', input.trim() && !loading ? 'text-white' : 'text-zinc-500')} />
          </button>
          </div>{/* end relative input wrapper */}
        </div>{/* end orange container */}

        {/* Chips — only before first message */}
        {messages.length === 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  setInput(chip.q)
                  textareaRef.current?.focus()
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800 transition-all"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Clear */}
        {messages.length > 0 && !loading && (
          <div className="flex justify-center">
            <button
              onClick={() => setMessages([])}
              className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
            >
              Clear conversation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
