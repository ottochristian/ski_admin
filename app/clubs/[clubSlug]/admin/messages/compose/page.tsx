'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Users } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'
import { useSelectedSeason } from '@/lib/contexts/season-context'

type TargetOption = {
  id: string
  type: 'program' | 'sub_program' | 'group'
  label: string       // short name
  breadcrumb: string  // e.g. "Alpine Racing › Moguls A › Group 1"
}

export default function AdminComposeMessagePage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const router = useRouter()

  const [supabase] = useState(() => createClient())
  const selectedSeason = useSelectedSeason()
  const [targets, setTargets] = useState<TargetOption[]>([])
  const [loadingTargets, setLoadingTargets] = useState(true)

  const [targetId, setTargetId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [additionalEmails, setAdditionalEmails] = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [familyPreview, setFamilyPreview] = useState<string[]>([])
  const [loadingCount, setLoadingCount] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedAdditionalEmails = additionalEmails
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)

  const invalidEmails = parsedAdditionalEmails.filter(
    (e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  )

  // Load all programs → sub-programs → groups for this club
  useEffect(() => {
    async function loadTargets() {
      setLoadingTargets(true)

      // Get club id from slug
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('slug', clubSlug)
        .single()

      if (!club) { setLoadingTargets(false); return }

      let programsQuery = supabase
        .from('programs')
        .select(`
          id, name,
          sub_programs(
            id, name,
            groups(id, name)
          )
        `)
        .eq('club_id', club.id)
        .order('name')

      if (selectedSeason?.id) {
        programsQuery = programsQuery.eq('season_id', selectedSeason.id)
      }

      const { data: programs } = await programsQuery

      const options: TargetOption[] = []

      for (const p of programs ?? []) {
        options.push({ id: p.id, type: 'program', label: p.name, breadcrumb: p.name })

        const sps = (p as any).sub_programs ?? []
        for (const sp of sps) {
          options.push({
            id: sp.id,
            type: 'sub_program',
            label: sp.name,
            breadcrumb: `${p.name} › ${sp.name}`,
          })

          const groups = (sp as any).groups ?? []
          for (const g of groups) {
            options.push({
              id: g.id,
              type: 'group',
              label: g.name,
              breadcrumb: `${p.name} › ${sp.name} › ${g.name}`,
            })
          }
        }
      }

      setTargets(options)
      setLoadingTargets(false)
    }

    loadTargets()
  }, [supabase, clubSlug, selectedSeason?.id])

  // Fetch recipient count + family preview on target change
  useEffect(() => {
    if (!targetId) {
      setRecipientCount(null)
      setFamilyPreview([])
      return
    }

    const selected = targets.find((t) => t.id === targetId)
    if (!selected) return

    setLoadingCount(true)
    setFamilyPreview([])

    Promise.all([
      fetch(`/api/messages/recipient-count?target_type=${selected.type}&target_id=${targetId}`).then((r) => r.json()),
      fetch(`/api/messages/family-preview?target_type=${selected.type}&target_id=${targetId}`).then((r) => r.json()),
    ])
      .then(([countData, previewData]) => {
        setRecipientCount(countData.count ?? null)
        setFamilyPreview(previewData.families ?? [])
      })
      .catch(() => { setRecipientCount(null); setFamilyPreview([]) })
      .finally(() => setLoadingCount(false))
  }, [targetId, targets])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetId || !subject.trim() || !body.trim()) return
    if (invalidEmails.length > 0) return

    const selected = targets.find((t) => t.id === targetId)
    if (!selected) return

    setSending(true)
    setError(null)

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubSlug,
        subject: subject.trim(),
        body: body.trim(),
        target_type: selected.type,
        target_id: selected.id,
        additional_emails: parsedAdditionalEmails,
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

  const selectedTarget = targets.find((t) => t.id === targetId)

  return (
    <div className="max-w-2xl">
      <Link
        href={`${basePath}/messages`}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to messages
      </Link>

      <AdminPageHeader title="New Message" description="Send a message to families across your programs." />

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Target */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Send to</label>
          {loadingTargets ? (
            <div className="h-10 rounded-lg bg-zinc-800 animate-pulse" />
          ) : targets.length === 0 ? (
            <p className="text-sm text-zinc-500">No programs found. Create a program first.</p>
          ) : (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Select a target…</option>
              {targets.map((t) => (
                <option key={`${t.type}-${t.id}`} value={t.id}>
                  {t.type === 'program' ? '' : t.type === 'sub_program' ? '  › ' : '    › › '}
                  {t.label}
                </option>
              ))}
            </select>
          )}

          {/* Breadcrumb + count + preview */}
          {targetId && selectedTarget && (
            <div className="mt-1.5 space-y-1">
              <p className="text-xs text-zinc-500 font-medium">{selectedTarget.breadcrumb}</p>
              <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                {loadingCount
                  ? 'Counting families…'
                  : recipientCount === null
                  ? ''
                  : `Will reach ${recipientCount} ${recipientCount === 1 ? 'family' : 'families'}`}
              </p>
              {familyPreview.length > 0 && (
                <p className="text-xs text-zinc-600 pl-4">
                  {familyPreview.join(', ')}
                  {recipientCount !== null && recipientCount > familyPreview.length && (
                    <span className="text-zinc-700"> +{recipientCount - familyPreview.length} more</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="Season kick-off details"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={8}
            placeholder="Type your message here…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-y"
          />
        </div>

        {/* Additional recipients */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">
            Additional recipients{' '}
            <span className="text-zinc-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={additionalEmails}
            onChange={(e) => setAdditionalEmails(e.target.value)}
            placeholder="jane@example.com, partner@org.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="text-xs text-zinc-600">
            Comma-separated. Each address gets its own individual email — no one sees the others.
          </p>
          {invalidEmails.length > 0 && (
            <p className="text-xs text-red-400">Invalid: {invalidEmails.join(', ')}</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={sending || !targetId || !subject.trim() || !body.trim() || invalidEmails.length > 0}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <Send className="h-4 w-4" />
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  )
}
