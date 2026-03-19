'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Sparkles, Loader2, Eye, EyeOff, X } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { FamilyAudienceSelector, SelectedRecipient, Program } from '@/components/family-audience-selector'
import { getNudgeContext, clearNudgeContext, type NudgeContextPayload } from '@/lib/nudge-context-store'

const MERGE_FIELDS = [
  { token: '{{parent_first_name}}', label: 'Parent name', example: 'Sarah' },
  { token: '{{athlete_first_name}}', label: 'Athlete name', example: 'Alex' },
  { token: '{{club_name}}', label: 'Club name', example: 'Mountain Ski Club' },
  { token: '{{program_name}}', label: 'Program name', example: 'Alpine Racing' },
]

export default function AdminComposeMessagePage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const router = useRouter()

  const [supabase] = useState(() => createClient())
  const selectedSeason = useSelectedSeason()

  const [programs, setPrograms] = useState<Program[]>([])
  const [loadingPrograms, setLoadingPrograms] = useState(true)
  const [aiEnabled, setAiEnabled] = useState(false)

  const [recipients, setRecipients] = useState<SelectedRecipient[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  const [isStreaming, setIsStreaming] = useState(false)

  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState<{ subject: string; body: string; sample_name: string | null } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Read nudge context ONCE at render time — persists across StrictMode double-mount
  // because module-level store survives the unmount/remount cycle.
  const [nudgeCtx] = useState<NudgeContextPayload | null>(() => getNudgeContext())

  const householdIds = recipients.filter(r => r.kind === 'household').map(r => r.id)
  const directEmails = recipients
    .filter((r): r is Extract<SelectedRecipient, { kind: 'email' }> => r.kind === 'email')
    .map(r => r.email)
  const hasAudience = recipients.length > 0

  // Load programs
  useEffect(() => {
    async function load() {
      setLoadingPrograms(true)
      const { data: club } = await supabase.from('clubs').select('id').eq('slug', clubSlug).single()
      if (!club) { setLoadingPrograms(false); return }
      let q = supabase
        .from('programs')
        .select('id, name, sub_programs(id, name, groups(id, name))')
        .eq('club_id', club.id)
        .order('name')
      if (selectedSeason?.id) q = q.eq('season_id', selectedSeason.id)
      const { data } = await q
      setPrograms((data as any) ?? [])
      setLoadingPrograms(false)
    }
    load()
  }, [supabase, clubSlug, selectedSeason?.id])

  useEffect(() => {
    fetch('/api/admin/ai/toggle')
      .then(r => r.json())
      .then(d => setAiEnabled(d.ai_enabled && d.ai_insights_enabled))
      .catch(() => {})
  }, [])

  // Process nudge context — AbortController handles StrictMode double-mount:
  // mount #1 starts fetch+stream, cleanup aborts both, mount #2 reruns cleanly.
  useEffect(() => {
    if (!nudgeCtx) return
    clearNudgeContext()

    const controller = new AbortController()
    const { signal } = controller

    const fetchBody = nudgeCtx.household_ids?.length
      ? { household_ids: nudgeCtx.household_ids }
      : nudgeCtx.target
      ? { target_type: nudgeCtx.target.type, target_id: nudgeCtx.target.id }
      : null

    if (fetchBody) {
      fetch('/api/messages/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fetchBody),
        signal,
      })
        .then(r => r.json())
        .then(data => {
          if (!signal.aborted && data.households?.length) {
            setRecipients(data.households.map((h: { id: string; name: string }) => ({
              kind: 'household' as const, id: h.id, name: h.name,
            })))
          }
        })
        .catch(() => {})
    }

    streamNudgeDraft(nudgeCtx, signal)

    return () => controller.abort()
  }, [nudgeCtx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Legacy message_prefill (from other flows)
  useEffect(() => {
    const prefillRaw = sessionStorage.getItem('message_prefill')
    if (!prefillRaw) return
    sessionStorage.removeItem('message_prefill')
    try {
      const prefill = JSON.parse(prefillRaw)
      if (prefill.subject) setSubject(prefill.subject)
      if (prefill.body) setBody(prefill.body)
      if (prefill.household_ids?.length) {
        fetch('/api/messages/households', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ household_ids: prefill.household_ids }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.households?.length) {
              setRecipients(data.households.map((h: { id: string; name: string }) => ({
                kind: 'household' as const, id: h.id, name: h.name,
              })))
            }
          })
          .catch(() => {})
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function streamNudgeDraft(ctx: NudgeContextPayload, signal: AbortSignal) {
    if (signal.aborted) return
    setIsStreaming(true)
    setSubject('')
    setBody('')

    try {
      const res = await fetch(ctx.draft_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: ctx.nudgeType,
          title: ctx.title,
          detail: ctx.detail,
          target_name: ctx.target_name,
          recipient_count: ctx.recipient_count,
          preview_names: ctx.preview_names,
        }),
        signal,
      })

      if (!res.ok || !res.body || signal.aborted) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let subjectDone = false
      let bodyText = ''

      while (true) {
        if (signal.aborted) break
        const { done, value } = await reader.read()
        if (done || signal.aborted) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk

        if (!subjectDone) {
          const sepIdx = accumulated.indexOf('\n\n')
          if (sepIdx !== -1) {
            setSubject(accumulated.slice(0, sepIdx).trim())
            subjectDone = true
            bodyText = accumulated.slice(sepIdx + 2)
            setBody(bodyText)
          }
        } else {
          bodyText += chunk
          setBody(bodyText)
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('[stream draft]', err)
    } finally {
      if (!signal.aborted) setIsStreaming(false)
    }
  }

  useEffect(() => { setPreview(null); setShowPreview(false) }, [body, subject])

  function insertMergeField(token: string) {
    const el = bodyRef.current
    if (!el) { setBody(prev => prev + token); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newBody = body.slice(0, start) + token + body.slice(end)
    setBody(newBody)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = start + token.length
      el.selectionEnd = start + token.length
    })
  }

  async function handleAiDraft() {
    if (!aiPrompt.trim()) return
    setDrafting(true)
    setDraftError(null)
    try {
      const res = await fetch('/api/admin/ai/messages/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          recipient_count: householdIds.length,
          season_name: selectedSeason?.name,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSubject(data.subject ?? '')
      setBody(data.body ?? '')
      setShowAiPanel(false)
      setAiPrompt('')
    } catch {
      setDraftError('Failed to generate draft. Please try again.')
    } finally {
      setDrafting(false)
    }
  }

  async function handlePreview() {
    const firstHousehold = recipients.find(r => r.kind === 'household') as
      Extract<SelectedRecipient, { kind: 'household' }> | undefined
    if (!body.trim() || !firstHousehold) return
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/messages/merge-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_id: firstHousehold.id, subject: subject.trim(), body: body.trim() }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPreview(data)
      setShowPreview(true)
    } catch {
      // silent
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasAudience || !subject.trim() || !body.trim()) return

    setSending(true)
    setError(null)

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubSlug,
        subject: subject.trim(),
        body: body.trim(),
        targets: [],
        household_ids: householdIds,
        additional_emails: directEmails,
        season_id: selectedSeason?.id ?? undefined,
      }),
    })

    if (res.ok) {
      router.push(`${basePath}/messages`)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to send message.')
      setSending(false)
    }
  }

  const hasMergeFields = /\{\{[^}]+\}\}/.test(body)
  const canPreview = recipients.some(r => r.kind === 'household')

  return (
    <div className="max-w-2xl">
      <Link href={`${basePath}/messages`} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to messages
      </Link>

      <AdminPageHeader title="New Message" description="Send a message to families across your programs." />

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">

        {/* To: */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">To</label>
          <FamilyAudienceSelector
            selected={recipients}
            onChange={setRecipients}
            programs={programs}
            loadingPrograms={loadingPrograms}
          />
          {recipients.length > 0 && (
            <p className="text-xs text-zinc-600">
              {householdIds.length > 0 && `${householdIds.length} ${householdIds.length === 1 ? 'family' : 'families'}`}
              {householdIds.length > 0 && directEmails.length > 0 && ', '}
              {directEmails.length > 0 && `${directEmails.length} direct email${directEmails.length === 1 ? '' : 's'}`}
            </p>
          )}
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Subject</label>
          {isStreaming && !subject ? (
            <div className="h-10 rounded-lg bg-zinc-800 animate-pulse" />
          ) : (
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
              placeholder="Season kick-off details"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          )}
        </div>

        {/* Message body */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-300">
              Message
              {isStreaming && (
                <span className="ml-2 text-xs font-normal text-orange-400 animate-pulse">AI is writing…</span>
              )}
            </label>
            {aiEnabled && !isStreaming && (
              <button
                type="button"
                onClick={() => setShowAiPanel(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Draft with AI
              </button>
            )}
          </div>

          {showAiPanel && !isStreaming && (
            <div className="rounded-lg border border-orange-900/50 bg-zinc-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest">AI Draft</p>
                <button type="button" onClick={() => { setShowAiPanel(false); setAiPrompt(''); setDraftError(null) }}>
                  <X className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                </button>
              </div>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                rows={3}
                placeholder="What would you like to say? e.g. 'Remind families that waivers are due Friday'"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiDraft() }}
              />
              {draftError && <p className="text-xs text-red-400">{draftError}</p>}
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-600">Draft includes personalization merge fields</p>
                <button
                  type="button"
                  onClick={handleAiDraft}
                  disabled={drafting || !aiPrompt.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition-colors"
                >
                  {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {drafting ? 'Drafting…' : 'Generate'}
                </button>
              </div>
            </div>
          )}

          <textarea
            ref={bodyRef}
            value={isStreaming ? body + '▊' : body}
            onChange={e => { if (!isStreaming) setBody(e.target.value) }}
            readOnly={isStreaming}
            required
            rows={10}
            placeholder={isStreaming ? '' : 'Type your message here…'}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-y"
          />

          {!isStreaming && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-zinc-600">Personalise:</span>
              {MERGE_FIELDS.map(({ token, label, example }) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertMergeField(token)}
                  title={`Inserts as "${example}" for each recipient`}
                  className="px-2 py-0.5 rounded border border-orange-900/60 bg-orange-950/30 text-[11px] font-medium text-orange-400 hover:bg-orange-900/30 hover:text-orange-300 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {!isStreaming && (hasMergeFields || body.trim()) && canPreview && (
            <div>
              {!showPreview ? (
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={loadingPreview}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {loadingPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  {loadingPreview ? 'Loading preview…' : 'Preview personalized message'}
                </button>
              ) : preview && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                      Preview — as seen by {preview.sample_name ?? 'recipient'}
                    </p>
                    <button type="button" onClick={() => setShowPreview(false)}>
                      <EyeOff className="h-3.5 w-3.5 text-zinc-600 hover:text-zinc-400" />
                    </button>
                  </div>
                  {preview.subject && <p className="text-xs font-semibold text-zinc-300">{preview.subject}</p>}
                  <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{preview.body}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <button
          type="submit"
          disabled={isStreaming || sending || !hasAudience || !subject.trim() || !body.trim()}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <Send className="h-4 w-4" />
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  )
}
