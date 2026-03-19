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

export default function CoachComposeMessagePage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/coach`
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

  // Derived options
  const selectedProgram = programs.find((p) => p.id === programId)
  const subProgramOptions = selectedProgram?.sub_programs ?? []
  const groupOptions = subProgramIds.length > 0
    ? subProgramOptions.filter((sp) => subProgramIds.includes(sp.id)).flatMap((sp) => sp.groups)
    : subProgramOptions.flatMap((sp) => sp.groups)

  function handleProgramChange(id: string) {
    setProgramId(id)
    setSubProgramIds([])
    setGroupIds([])
  }
  function handleSubProgramChange(ids: string[]) {
    setSubProgramIds(ids)
    setGroupIds([])
  }

  const targets = (() => {
    if (groupIds.length > 0) return groupIds.map((id) => ({ type: 'group' as const, id }))
    if (subProgramIds.length > 0) return subProgramIds.map((id) => ({ type: 'sub_program' as const, id }))
    if (programId) return [{ type: 'program' as const, id: programId }]
    return []
  })()

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

      // Resolve all assigned sub_program_ids
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

      // Groups → sub_program_id
      if (assignedGroupIds.length > 0) {
        const { data: groupRows } = await supabase
          .from('groups').select('sub_program_id').in('id', assignedGroupIds)
        groupRows?.forEach((g: { sub_program_id: string | null }) => {
          if (g.sub_program_id) assignedSpIds.add(g.sub_program_id)
        })
      }

      if (!assignedSpIds.size) { setLoadingPrograms(false); return }

      // Fetch sub_programs + their programs + groups
      const { data: spRows } = await supabase
        .from('sub_programs')
        .select('id, name, program_id, programs(id, name), groups(id, name)')
        .in('id', [...assignedSpIds])

      // Group into Program → SubProgram → Groups structure
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

      const result = [...programMap.values()].sort((a, b) => a.name.localeCompare(b.name))
      setPrograms(result)

      // Auto-select if only one program
      if (result.length === 1) {
        setProgramId(result[0].id)
        if (result[0].sub_programs.length === 1) {
          setSubProgramIds([result[0].sub_programs[0].id])
        }
      }

      setLoadingPrograms(false)
    }
    load()
  }, [supabase, selectedSeason?.id])

  // Fetch recipient count + preview
  const fetchCount = useCallback(async () => {
    if (targets.length === 0) { setRecipientCount(null); setFamilyPreview([]); return }

    setLoadingCount(true)
    setFamilyPreview([])

    try {
      const counts = await Promise.all(
        targets.map((t) =>
          fetch(`/api/messages/recipient-count?target_type=${t.type}&target_id=${t.id}`).then((r) => r.json())
        )
      )
      const preview = await fetch(
        `/api/messages/family-preview?target_type=${targets[0].type}&target_id=${targets[0].id}`
      ).then((r) => r.json())

      setRecipientCount(counts.reduce((sum, c) => sum + (c.count ?? 0), 0))
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

      <AdminPageHeader title="New Message" description="Send a message to families in your programs." />

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">

        {/* Step 1 — Program */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Program</label>
          {loadingPrograms ? (
            <div className="h-10 rounded-lg bg-zinc-800 animate-pulse" />
          ) : programs.length === 0 ? (
            <p className="text-sm text-zinc-500">No programs assigned. Contact your club admin.</p>
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

        {/* Step 2 — Sub-programs */}
        {selectedProgram && subProgramOptions.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">
              Sub-program <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <MultiSearchSelect
              options={subProgramOptions.map((sp) => ({ id: sp.id, label: sp.name }))}
              selected={subProgramIds}
              onChange={handleSubProgramChange}
              placeholder="Search sub-programs…"
            />
          </div>
        )}

        {/* Step 3 — Groups */}
        {groupOptions.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">
              Group <span className="text-zinc-500 font-normal">(optional)</span>
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
            placeholder="Practice schedule update"
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
            placeholder="jane@example.com, coach@club.org"
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
