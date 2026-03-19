'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, Users } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'

type TargetOption = {
  id: string
  name: string
  type: 'program' | 'sub_program' | 'group'
  displayName: string
}

export default function ComposeMessagePage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/coach`
  const router = useRouter()

  const [supabase] = useState(() => createClient())
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

  // Parse and validate additional emails
  const parsedAdditionalEmails = additionalEmails
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)

  const invalidEmails = parsedAdditionalEmails.filter(
    (e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  )

  // Load coach's assigned sub-programs (same logic as schedule filter)
  useEffect(() => {
    async function loadTargets() {
      setLoadingTargets(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: coachRow } = await supabase
        .from('coaches')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (!coachRow) {
        setLoadingTargets(false)
        return
      }

      const { data: assignments } = await supabase
        .from('coach_assignments')
        .select('program_id, sub_program_id, group_id')
        .eq('coach_id', coachRow.id)

      if (!assignments || assignments.length === 0) {
        setLoadingTargets(false)
        return
      }

      const directSpIds = new Set<string>()
      const groupIds: string[] = []

      for (const a of assignments) {
        if (a.sub_program_id) directSpIds.add(a.sub_program_id)
        if (a.group_id) groupIds.push(a.group_id)
        if (a.program_id && !a.sub_program_id && !a.group_id) {
          // Program-level: include all sub-programs
          const { data: sps } = await supabase
            .from('sub_programs')
            .select('id')
            .eq('program_id', a.program_id)
          sps?.forEach((sp: { id: string }) => directSpIds.add(sp.id))
        }
      }

      // Resolve group → sub_program
      if (groupIds.length > 0) {
        const { data: groupRows } = await supabase
          .from('groups')
          .select('id, name, sub_program_id')
          .in('id', groupIds)
        groupRows?.forEach((g: { id: string; name: string; sub_program_id: string | null }) => {
          if (g.sub_program_id) directSpIds.add(g.sub_program_id)
        })
      }

      if (directSpIds.size === 0) {
        setLoadingTargets(false)
        return
      }

      // Fetch sub-program names + their program names
      const { data: spRows } = await supabase
        .from('sub_programs')
        .select('id, name, programs(name)')
        .in('id', [...directSpIds])

      const options: TargetOption[] = (spRows ?? []).map((sp: any) => {
        const programName = Array.isArray(sp.programs) ? sp.programs[0]?.name : sp.programs?.name
        return {
          id: sp.id,
          name: sp.name,
          type: 'sub_program' as const,
          displayName: programName ? `${programName} › ${sp.name}` : sp.name,
        }
      })

      setTargets(options)
      if (options.length === 1) setTargetId(options[0].id)
      setLoadingTargets(false)
    }

    loadTargets()
  }, [supabase])

  // Fetch recipient count + family preview when target changes
  useEffect(() => {
    if (!targetId) {
      setRecipientCount(null)
      setFamilyPreview([])
      return
    }

    const selectedTarget = targets.find((t) => t.id === targetId)
    if (!selectedTarget) return

    setLoadingCount(true)
    setFamilyPreview([])

    Promise.all([
      fetch(`/api/messages/recipient-count?target_type=${selectedTarget.type}&target_id=${targetId}`).then((r) => r.json()),
      fetch(`/api/messages/family-preview?target_type=${selectedTarget.type}&target_id=${targetId}`).then((r) => r.json()),
    ])
      .then(([countData, previewData]) => {
        setRecipientCount(countData.count ?? null)
        setFamilyPreview(previewData.families ?? [])
      })
      .catch(() => {
        setRecipientCount(null)
        setFamilyPreview([])
      })
      .finally(() => setLoadingCount(false))
  }, [targetId, targets])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetId || !subject.trim() || !body.trim()) return
    if (invalidEmails.length > 0) return

    const selectedTarget = targets.find((t) => t.id === targetId)
    if (!selectedTarget) return

    setSending(true)
    setError(null)

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubSlug,
        subject: subject.trim(),
        body: body.trim(),
        target_type: selectedTarget.type,
        target_id: selectedTarget.id,
        additional_emails: parsedAdditionalEmails,
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
      <Link
        href={`${basePath}/messages`}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to messages
      </Link>

      <AdminPageHeader title="New Message" description="Send a message to families in your programs." />

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Target */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">Send to</label>
          {loadingTargets ? (
            <div className="h-10 rounded-lg bg-zinc-800 animate-pulse" />
          ) : targets.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No programs assigned. Contact your club admin.
            </p>
          ) : targets.length === 1 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-sm text-foreground">
              <Users className="h-4 w-4 text-zinc-400" />
              {targets[0].displayName}
            </div>
          ) : (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Select a program…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          )}

          {/* Recipient count + family name preview */}
          {targetId && (
            <div className="mt-1.5 space-y-1">
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
            Additional recipients{' '}
            <span className="text-zinc-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={additionalEmails}
            onChange={(e) => setAdditionalEmails(e.target.value)}
            placeholder="jane@example.com, coach@club.org"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="text-xs text-zinc-600">
            Comma-separated. Each address gets its own individual email — no one sees the others.
          </p>
          {invalidEmails.length > 0 && (
            <p className="text-xs text-red-400">
              Invalid: {invalidEmails.join(', ')}
            </p>
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
