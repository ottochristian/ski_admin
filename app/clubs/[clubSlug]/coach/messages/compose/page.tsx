'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { FamilyAudienceSelector, SelectedRecipient, Program } from '@/components/family-audience-selector'
import { getNudgeContext, clearNudgeContext, type NudgeContextPayload } from '@/lib/nudge-context-store'

export default function CoachComposeMessagePage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/coach`
  const router = useRouter()

  const [supabase] = useState(() => createClient())
  const selectedSeason = useSelectedSeason()

  const [programs, setPrograms] = useState<Program[]>([])
  const [loadingPrograms, setLoadingPrograms] = useState(true)

  const [recipients, setRecipients] = useState<SelectedRecipient[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isStreaming, setIsStreaming] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Read nudge context once at render time — persists across StrictMode double-mount
  const [nudgeCtx] = useState<NudgeContextPayload | null>(() => getNudgeContext())

  const householdIds = recipients.filter(r => r.kind === 'household').map(r => r.id)
  const directEmails = recipients
    .filter((r): r is Extract<SelectedRecipient, { kind: 'email' }> => r.kind === 'email')
    .map(r => r.email)
  const hasAudience = recipients.length > 0

  // Load programs scoped to coach's assignments
  useEffect(() => {
    async function load() {
      setLoadingPrograms(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingPrograms(false); return }

      const { data: coachRow } = await supabase
        .from('coaches').select('id').eq('profile_id', user.id).single()
      if (!coachRow) { setLoadingPrograms(false); return }

      const { data: assignments } = await supabase
        .from('coach_assignments')
        .select('program_id, sub_program_id, group_id')
        .eq('coach_id', coachRow.id)

      if (!assignments?.length) { setLoadingPrograms(false); return }

      const assignedSpIds = new Set<string>()
      const assignedGroupIds: string[] = []

      for (const a of assignments) {
        if (a.sub_program_id) assignedSpIds.add(a.sub_program_id)
        if (a.group_id) assignedGroupIds.push(a.group_id)
        if (a.program_id && !a.sub_program_id && !a.group_id) {
          const { data: sps } = await supabase
            .from('sub_programs').select('id').eq('program_id', a.program_id)
          sps?.forEach((sp: { id: string }) => assignedSpIds.add(sp.id))
        }
      }

      if (assignedGroupIds.length > 0) {
        const { data: groupRows } = await supabase
          .from('groups').select('sub_program_id').in('id', assignedGroupIds)
        groupRows?.forEach((g: { sub_program_id: string | null }) => {
          if (g.sub_program_id) assignedSpIds.add(g.sub_program_id)
        })
      }

      if (!assignedSpIds.size) { setLoadingPrograms(false); return }

      const { data: spRows } = await supabase
        .from('sub_programs')
        .select('id, name, program_id, programs(id, name), groups(id, name)')
        .in('id', [...assignedSpIds])

      const programMap = new Map<string, Program>()
      for (const sp of spRows ?? []) {
        const prog = Array.isArray((sp as any).programs) ? (sp as any).programs[0] : (sp as any).programs
        if (!prog) continue
        if (!programMap.has(prog.id)) {
          programMap.set(prog.id, { id: prog.id, name: prog.name, sub_programs: [] })
        }
        programMap.get(prog.id)!.sub_programs.push({
          id: sp.id,
          name: sp.name,
          groups: ((sp as any).groups ?? []).map((g: any) => ({ id: g.id, name: g.name })),
        })
      }

      setPrograms([...programMap.values()].sort((a, b) => a.name.localeCompare(b.name)))
      setLoadingPrograms(false)
    }
    load()
  }, [supabase, selectedSeason?.id])

  // Process nudge context — AbortController handles StrictMode double-mount
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

  return (
    <div className="max-w-2xl">
      <Link href={`${basePath}/messages`} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to messages
      </Link>

      <AdminPageHeader title="New Message" description="Send a message to families in your programs." />

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
              placeholder="Practice schedule update"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          )}
        </div>

        {/* Message body */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">
            Message
            {isStreaming && (
              <span className="ml-2 text-xs font-normal text-orange-400 animate-pulse">AI is writing…</span>
            )}
          </label>
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
