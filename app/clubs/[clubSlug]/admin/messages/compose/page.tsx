'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Users } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { SearchSelect } from '@/components/search-select'
import { MultiSearchSelect } from '@/components/multi-search-select'

type Group = { id: string; name: string }
type SubProgram = { id: string; name: string; groups: Group[] }
type Program = { id: string; name: string; sub_programs: SubProgram[] }

export default function AdminComposeMessagePage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const router = useRouter()

  const [supabase] = useState(() => createClient())
  const selectedSeason = useSelectedSeason()

  const [programs, setPrograms] = useState<Program[]>([])
  const [loadingPrograms, setLoadingPrograms] = useState(true)

  // Cascade state
  const [programId, setProgramId] = useState('')
  const [subProgramIds, setSubProgramIds] = useState<string[]>([])
  const [groupIds, setGroupIds] = useState<string[]>([])

  // Form state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [additionalEmails, setAdditionalEmails] = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [familyPreview, setFamilyPreview] = useState<string[]>([])
  const [loadingCount, setLoadingCount] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedAdditionalEmails = additionalEmails
    .split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
  const invalidEmails = parsedAdditionalEmails.filter(
    (e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  )

  // Derived options for each level
  const selectedProgram = programs.find((p) => p.id === programId)
  const subProgramOptions = selectedProgram?.sub_programs ?? []
  const groupOptions = subProgramIds.length > 0
    ? subProgramOptions
        .filter((sp) => subProgramIds.includes(sp.id))
        .flatMap((sp) => sp.groups)
    : subProgramOptions.flatMap((sp) => sp.groups)

  // Reset downstream when upstream changes
  function handleProgramChange(id: string) {
    setProgramId(id)
    setSubProgramIds([])
    setGroupIds([])
  }
  function handleSubProgramChange(ids: string[]) {
    setSubProgramIds(ids)
    setGroupIds([])
  }

  // Build targets array for API
  const targets = (() => {
    if (groupIds.length > 0) return groupIds.map((id) => ({ type: 'group' as const, id }))
    if (subProgramIds.length > 0) return subProgramIds.map((id) => ({ type: 'sub_program' as const, id }))
    if (programId) return [{ type: 'program' as const, id: programId }]
    return []
  })()

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

  // Fetch recipient count + preview whenever targets change
  const fetchCount = useCallback(async () => {
    if (targets.length === 0) { setRecipientCount(null); setFamilyPreview([]); return }

    setLoadingCount(true)
    setFamilyPreview([])

    try {
      // Sum counts across all targets
      const counts = await Promise.all(
        targets.map((t) =>
          fetch(`/api/messages/recipient-count?target_type=${t.type}&target_id=${t.id}`).then((r) => r.json())
        )
      )
      // Use the first target for family preview (representative sample)
      const preview = await fetch(
        `/api/messages/family-preview?target_type=${targets[0].type}&target_id=${targets[0].id}`
      ).then((r) => r.json())

      const total = counts.reduce((sum, c) => sum + (c.count ?? 0), 0)
      setRecipientCount(total)
      setFamilyPreview(preview.families ?? [])
    } catch {
      setRecipientCount(null)
      setFamilyPreview([])
    } finally {
      setLoadingCount(false)
    }
  }, [JSON.stringify(targets)])

  useEffect(() => { fetchCount() }, [fetchCount])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (targets.length === 0 || !subject.trim() || !body.trim()) return
    if (invalidEmails.length > 0) return

    setSending(true)
    setError(null)

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubSlug,
        subject: subject.trim(),
        body: body.trim(),
        targets,
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

  return (
    <div className="max-w-2xl">
      <Link href={`${basePath}/messages`} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to messages
      </Link>

      <AdminPageHeader title="New Message" description="Send a message to families across your programs." />

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">

        {/* Step 1 — Program */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Program</label>
          {loadingPrograms ? (
            <div className="h-10 rounded-lg bg-zinc-800 animate-pulse" />
          ) : (
            <SearchSelect
              options={programs.map((p) => ({ id: p.id, label: p.name }))}
              value={programId}
              onChange={handleProgramChange}
              placeholder="Search programs…"
              clearable
            />
          )}
        </div>

        {/* Step 2 — Sub-programs (optional) */}
        {selectedProgram && subProgramOptions.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">
              Sub-program <span className="text-zinc-500 font-normal">(optional — leave empty to send to whole program)</span>
            </label>
            <MultiSearchSelect
              options={subProgramOptions.map((sp) => ({ id: sp.id, label: sp.name }))}
              selected={subProgramIds}
              onChange={handleSubProgramChange}
              placeholder="Search sub-programs…"
            />
          </div>
        )}

        {/* Step 3 — Groups (optional) */}
        {(subProgramIds.length > 0 || (selectedProgram && subProgramIds.length === 0)) && groupOptions.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">
              Group <span className="text-zinc-500 font-normal">(optional — leave empty to send to selected sub-programs)</span>
            </label>
            <MultiSearchSelect
              options={groupOptions.map((g) => ({ id: g.id, label: g.name }))}
              selected={groupIds}
              onChange={setGroupIds}
              placeholder="Search groups…"
            />
          </div>
        )}

        {/* Recipient count + preview */}
        {targets.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 space-y-1">
            <p className="text-xs text-zinc-400 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {loadingCount
                ? 'Counting families…'
                : recipientCount === null
                ? 'No registrations found'
                : <><span className="font-semibold text-foreground">{recipientCount}</span> {recipientCount === 1 ? 'family' : 'families'} will receive this message</>
              }
            </p>
            {familyPreview.length > 0 && (
              <p className="text-xs text-zinc-600 pl-5">
                {familyPreview.join(', ')}
                {recipientCount !== null && recipientCount > familyPreview.length && (
                  <span> +{recipientCount - familyPreview.length} more</span>
                )}
              </p>
            )}
          </div>
        )}

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
            Additional recipients <span className="text-zinc-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={additionalEmails}
            onChange={(e) => setAdditionalEmails(e.target.value)}
            placeholder="jane@example.com, partner@org.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="text-xs text-zinc-600">Comma-separated. Each address gets its own individual email.</p>
          {invalidEmails.length > 0 && <p className="text-xs text-red-400">Invalid: {invalidEmails.join(', ')}</p>}
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <button
          type="submit"
          disabled={sending || targets.length === 0 || !subject.trim() || !body.trim() || invalidEmails.length > 0}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <Send className="h-4 w-4" />
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  )
}
