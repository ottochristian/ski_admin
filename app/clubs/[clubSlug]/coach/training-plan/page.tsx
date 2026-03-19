'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { useClub } from '@/lib/club-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { InlineLoading } from '@/components/ui/loading-states'
import { Sparkles, ChevronDown, RotateCcw, Download, Lock, Pencil, Check, CalendarPlus, History, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────
type Program = { id: string; name: string }
type SubProgram = { id: string; name: string; program_id: string }
type Group = { id: string; name: string; sub_program_id: string }
type PastPlan = {
  id: string
  week_start: string
  season_id: string
  program_id: string
  sub_program_id: string | null
  group_id: string | null
  original_plan: string
  edited_plan: string | null
  plan_context: Record<string, string | null> | null
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function weekStartMonday(d = new Date()): string {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

// ── Plan display ───────────────────────────────────────────────────────────
function PlanDisplay({ text }: { text: string }) {
  // Split on ## headings to create sections
  const sections = text.split(/^(#{1,3} .+)$/m).filter(Boolean)

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {sections.map((section, i) => {
        if (/^#{1,3} /.test(section)) {
          const level = (section.match(/^(#+)/) || ['', ''])[1].length
          const title = section.replace(/^#+\s*/, '')
          if (level === 1) return <h2 key={i} className="text-xl font-bold mt-6 first:mt-0">{title}</h2>
          if (level === 2) return <h3 key={i} className="text-base font-semibold mt-5 border-b border-border pb-1">{title}</h3>
          return <h4 key={i} className="text-sm font-semibold text-blue-400 mt-4">{title}</h4>
        }
        // Render content lines
        const lines = section.split('\n').filter((l) => l.trim())
        return (
          <div key={i} className="space-y-1.5">
            {lines.map((line, j) => {
              if (/^\*\*(.+)\*\*$/.test(line.trim())) {
                return <p key={j} className="font-semibold">{line.replace(/\*\*/g, '')}</p>
              }
              if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
                return (
                  <div key={j} className="flex gap-2">
                    <span className="text-blue-400 mt-1 shrink-0">•</span>
                    <span className="text-foreground">{line.replace(/^[-•]\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1')}</span>
                  </div>
                )
              }
              if (line.trim() === '---') return <hr key={j} className="my-3 border-border" />
              return <p key={j} className="text-foreground">{line.replace(/\*\*(.+?)\*\*/g, '$1')}</p>
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Select component ───────────────────────────────────────────────────────
function Select({
  label, value, onChange, options, placeholder, disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { id: string; name: string }[]
  placeholder: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || options.length === 0}
          className={cn(
            'w-full appearance-none rounded-md border border-border bg-card px-3 py-2 pr-8 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            disabled || options.length === 0
              ? 'text-muted-foreground cursor-not-allowed bg-secondary'
              : 'cursor-pointer hover:border-zinc-500'
          )}
        >
          <option value="">{options.length === 0 ? 'None available' : placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  )
}

// ── History tab ────────────────────────────────────────────────────────────
function HistoryTab({
  plans,
  loading,
  selected,
  onSelect,
  onBack,
  onPlanUpdated,
  defaultStartTime,
  onPushToSchedule,
}: {
  plans: PastPlan[]
  loading: boolean
  selected: PastPlan | null
  onSelect: (p: PastPlan) => void
  onBack: () => void
  onPlanUpdated: (updated: PastPlan) => void
  defaultStartTime: string
  onPushToSchedule: (plan: PastPlan, startTime: string) => Promise<void>
}) {
  const [supabase] = useState(() => createClient())
  const [pushingId, setPushingId] = useState<string | null>(null)
  const [pushedIds, setPushedIds] = useState<Set<string>>(new Set())
  const [histStartTime, setHistStartTime] = useState(defaultStartTime)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset edit state when selected plan changes
  useEffect(() => {
    setEditing(false)
    setEditText('')
  }, [selected?.id])

  async function handlePush(p: PastPlan) {
    setPushingId(p.id)
    try {
      await onPushToSchedule(p, histStartTime)
      setPushedIds((prev) => new Set(prev).add(p.id))
    } finally {
      setPushingId(null)
    }
  }

  async function handleSave(p: PastPlan) {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('ai_training_plans')
        .update({ edited_plan: editText })
        .eq('id', p.id)
      if (error) throw error
      onPlanUpdated({ ...p, edited_plan: editText })
      setEditing(false)
      toast.success('Plan saved')
    } catch {
      toast.error('Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mr-2" />
        Loading past plans…
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="rounded-full bg-secondary p-4">
            <History className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No past plans yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Generated plans will appear here after you create them.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Detail view
  if (selected) {
    // Always show the most current version
    const currentText = selected.edited_plan ?? selected.original_plan

    const ctx = selected.plan_context ?? {}
    const scopeLabel = [ctx.program, ctx.sub_program, ctx.group].filter(Boolean).join(' › ')
    const weekLabel = selected.week_start
      ? new Date(selected.week_start + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '—'

    const isPushing = pushingId === selected.id
    const isPushed = pushedIds.has(selected.id)

    return (
      <div className="flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
            ← Back
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{scopeLabel || 'Training Plan'}</p>
            <p className="text-xs text-muted-foreground">Week of {weekLabel}</p>
          </div>
          {/* Edit / Save buttons */}
          {!editing ? (
            <Button
              variant="outline" size="sm"
              onClick={() => { setEditText(currentText); setEditing(true) }}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => handleSave(selected)}
                disabled={saving}
                className="gap-1.5 border-green-700 text-green-400 hover:bg-green-950/30"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
          {/* Start time + push button */}
          {!editing && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="time"
                  value={histStartTime}
                  onChange={(e) => setHistStartTime(e.target.value)}
                  className="h-8 w-28 text-xs"
                />
              </div>
              <Button
                size="sm"
                onClick={() => handlePush(selected)}
                disabled={isPushing || isPushed}
                className={cn('gap-1.5', isPushed && 'bg-green-600 hover:bg-green-600')}
              >
                {isPushed ? (
                  <><Check className="h-3.5 w-3.5" /> Added</>
                ) : isPushing ? (
                  <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Pushing…</>
                ) : (
                  <><CalendarPlus className="h-3.5 w-3.5" /> Push to Schedule</>
                )}
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Training Plan
              {selected.edited_plan && !editing && (
                <Badge variant="outline" className="text-xs border-green-700 text-green-400 bg-green-950/30 ml-1">
                  Edited
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="border-t pt-4 max-h-[70vh] overflow-y-auto">
            {editing ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Edit below, then click Save. The original AI-generated version is always preserved on the server.</p>
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[50vh] font-mono text-xs resize-y"
                />
              </div>
            ) : (
              <PlanDisplay text={currentText} />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // List view
  return (
    <div className="flex flex-col gap-3">
      {plans.map((p) => {
        const ctx = p.plan_context ?? {}
        const scopeLabel = [ctx.program, ctx.sub_program, ctx.group].filter(Boolean).join(' › ')
        const weekLabel = p.week_start
          ? new Date(p.week_start + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—'
        const createdLabel = new Date(p.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })

        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full text-left rounded-lg border border-border bg-card hover:bg-secondary/50 hover:border-zinc-600 transition-colors p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{scopeLabel || 'Training Plan'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Week of {weekLabel} · Generated {createdLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.edited_plan && (
                  <Badge variant="outline" className="text-xs border-green-700 text-green-400 bg-green-950/30">
                    Edited
                  </Badge>
                )}
                <ChevronDown className="-rotate-90 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function TrainingPlanPage() {
  const { club } = useClub()
  const currentSeason = useCurrentSeason()
  const [supabase] = useState(() => createClient())

  const [programs, setPrograms] = useState<Program[]>([])
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([])
  const [groups, setGroups] = useState<Group[]>([])

  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [programId, setProgramId] = useState('')
  const [subProgramId, setSubProgramId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [weekStart, setWeekStart] = useState(weekStartMonday)
  const [startTime, setStartTime] = useState('09:00')
  const [focus, setFocus] = useState('')
  const [notes, setNotes] = useState('')

  const [pastPlans, setPastPlans] = useState<PastPlan[]>([])
  const [pastPlansLoading, setPastPlansLoading] = useState(false)
  const [selectedPastPlan, setSelectedPastPlan] = useState<PastPlan | null>(null)

  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null)
  const [generating, setGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [plan, setPlan] = useState<{ text: string; context: Record<string, string | null> } | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [pushingToSchedule, setPushingToSchedule] = useState(false)
  const [pushedToSchedule, setPushedToSchedule] = useState(false)

  // Load past plans when history tab is opened
  useEffect(() => {
    if (activeTab !== 'history') return
    setPastPlansLoading(true)
    supabase
      .from('ai_training_plans')
      .select('id, week_start, season_id, program_id, sub_program_id, group_id, original_plan, edited_plan, plan_context, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setPastPlans((data as PastPlan[]) ?? [])
        setPastPlansLoading(false)
      })
  }, [activeTab])

  // Check if AI is enabled for this club (coach-accessible endpoint)
  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => setAiEnabled(d.ai_enabled ?? false))
      .catch(() => setAiEnabled(false))
  }, [])

  // Load programs when season changes
  useEffect(() => {
    if (!currentSeason?.id || !club?.id) return
    supabase
      .from('programs')
      .select('id, name')
      .eq('club_id', club.id)
      .eq('season_id', currentSeason.id)
      .eq('status', 'ACTIVE')
      .order('name')
      .then(({ data }) => {
        setPrograms(data ?? [])
        setProgramId('')
        setSubProgramId('')
        setGroupId('')
      })
  }, [currentSeason?.id, club?.id])

  // Load sub-programs when program changes
  useEffect(() => {
    if (!programId) { setSubPrograms([]); setSubProgramId(''); return }
    supabase
      .from('sub_programs')
      .select('id, name, program_id')
      .eq('program_id', programId)
      .eq('status', 'ACTIVE')
      .order('name')
      .then(({ data }) => {
        setSubPrograms(data ?? [])
        setSubProgramId('')
        setGroupId('')
      })
  }, [programId])

  // Load groups when sub-program changes
  useEffect(() => {
    if (!subProgramId) { setGroups([]); setGroupId(''); return }
    supabase
      .from('groups')
      .select('id, name, sub_program_id')
      .eq('sub_program_id', subProgramId)
      .order('name')
      .then(({ data }) => {
        setGroups(data ?? [])
        setGroupId('')
      })
  }, [subProgramId])

  async function handleGenerate() {
    if (!currentSeason?.id || !programId) {
      toast.error('Please select a program')
      return
    }

    setGenerating(true)
    setStreamingText('')
    setPlan(null)
    setPushedToSchedule(false)

    try {
      const res = await fetch('/api/ai/training-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: currentSeason.id,
          program_id: programId,
          sub_program_id: subProgramId || null,
          group_id: groupId || null,
          week_start: weekStart,
          focus: focus.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to generate plan')
        return
      }

      const contextHeader = res.headers.get('X-Plan-Context')
      const context: Record<string, string | null> = contextHeader ? JSON.parse(contextHeader) : {}
      const incomingPlanId = res.headers.get('X-Plan-Id')
      setPlanId(incomingPlanId)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setStreamingText(accumulated)
      }

      setPlan({ text: accumulated, context })
      setEditedText(accumulated)
      setStreamingText('')
      setEditing(false)
      toast.success('Training plan generated!')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!plan) return
    const text = editing ? editedText : plan.text
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-plan-${weekStart}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSaveEdit() {
    if (!plan) return
    setSavingEdit(true)
    setPlan({ ...plan, text: editedText })
    setEditing(false)
    // Persist edited version if we have a plan ID
    if (planId) {
      try {
        await supabase
          .from('ai_training_plans')
          .update({ edited_plan: editedText, updated_at: new Date().toISOString() })
          .eq('id', planId)
        toast.success('Plan saved')
      } catch {
        toast.success('Plan updated locally')
      }
    } else {
      toast.success('Plan updated')
    }
    setSavingEdit(false)
  }

  // Shared helper: parse markdown plan text into schedule-ready day objects
  function parsePlanDays(planText: string, weekStartStr: string) {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const weekStartDate = new Date(weekStartStr + 'T00:00:00')
    const weekStartDay = weekStartDate.getDay()

    const sections = planText.split(/(?=###\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s])/g)

    return sections
      .map((section) => {
        const dayMatch = section.match(/###\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)
        if (!dayMatch) return null
        const dayName = dayMatch[1]

        const targetDay = WEEKDAYS.indexOf(dayName)
        let diff = targetDay - weekStartDay
        if (diff < 0) diff += 7
        const d = new Date(weekStartDate)
        d.setDate(weekStartDate.getDate() + diff)
        const date = d.toISOString().split('T')[0]

        const sessionTypeMatch = section.match(/\*\*Session Type:\*\*\s*(.+)/)
        const sessionType = sessionTypeMatch?.[1]?.trim() || 'Training'

        const durationMatch = section.match(/\*\*Duration:\*\*\s*(.+)/)
        const durationStr = durationMatch?.[1]?.trim() || '2 hours'
        const hoursMatch = durationStr.match(/([\d.]+)\s*hour/)
        const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 2

        if (
          sessionType.toLowerCase().includes('rest') ||
          durationStr === '—' || durationStr === '-' || durationStr === 'N/A'
        ) return null

        return { date, sessionType, hours, notes: section.trim() }
      })
      .filter((d): d is { date: string; sessionType: string; hours: number; notes: string } => d !== null)
  }

  async function handlePushToSchedule() {
    if (!plan || !currentSeason?.id || !programId) return
    setPushingToSchedule(true)

    const planText = editing ? editedText : plan.text
    const trainingDays = parsePlanDays(planText, weekStart)

    if (trainingDays.length === 0) {
      toast.error('Could not parse training days from the plan.')
      setPushingToSchedule(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // If this plan was already pushed, delete those events first so re-pushing
      // replaces them instead of duplicating.
      let replaced = false
      if (planId) {
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .eq('ai_plan_id', planId)
        if (deleteError) {
          console.error('Failed to remove previous events:', deleteError)
          throw deleteError
        }
        replaced = true
      }

      const scopeLabel = [plan.context.sub_program, plan.context.group].filter(Boolean).join(' › ') || plan.context.program

      const events = trainingDays.map((d) => {
        const dateObj = new Date(d.date + 'T' + startTime + ':00')
        const endObj = new Date(dateObj.getTime() + (d.hours || 2) * 60 * 60 * 1000)
        return {
          club_id: club?.id,
          season_id: currentSeason.id,
          program_id: programId,
          sub_program_id: subProgramId || null,
          group_id: groupId || null,
          ai_plan_id: planId ?? null,
          title: `${d.sessionType} — ${scopeLabel}`,
          event_type: (d.sessionType.toLowerCase().includes('race') ? 'race' : 'training') as 'race' | 'training',
          start_at: dateObj.toISOString(),
          end_at: endObj.toISOString(),
          notes: d.notes,
          created_by: user.id,
        }
      })

      const { error } = await supabase.from('events').insert(events)
      if (error) {
        console.error('Push to schedule DB error:', error.message, error.code, error.details, error.hint)
        throw error
      }

      setPushedToSchedule(true)
      toast.success(
        replaced ? `Schedule updated — ${events.length} sessions replaced` : `${events.length} sessions added to schedule`,
        { description: 'View them in the Schedule tab' }
      )
    } catch (err) {
      const e = err as { message?: string }
      console.error('Push to schedule error:', e?.message ?? String(err))
      toast.error(e?.message ? `Failed: ${e.message}` : 'Failed to push to schedule')
    } finally {
      setPushingToSchedule(false)
    }
  }

  async function handlePushPastPlan(pastPlan: PastPlan, sessionStartTime: string) {
    if (!club?.id) {
      toast.error('Club not loaded. Please refresh and try again.')
      return
    }

    const planText = pastPlan.edited_plan ?? pastPlan.original_plan
    const trainingDays = parsePlanDays(planText, pastPlan.week_start)

    if (trainingDays.length === 0) {
      toast.error('Could not parse training days from this plan.')
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Delete any existing events for this plan first (replace, not duplicate)
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('ai_plan_id', pastPlan.id)
      if (deleteError) {
        console.error('Failed to remove previous events:', deleteError)
        throw deleteError
      }

      const ctx = pastPlan.plan_context ?? {}
      const scopeLabel = [ctx.sub_program, ctx.group].filter(Boolean).join(' › ') || ctx.program || 'Training'

      const events = trainingDays.map((d) => {
        const dateObj = new Date(d.date + 'T' + sessionStartTime + ':00')
        const endObj = new Date(dateObj.getTime() + (d.hours || 2) * 60 * 60 * 1000)
        return {
          club_id: club.id,
          season_id: pastPlan.season_id,
          program_id: pastPlan.program_id,
          sub_program_id: pastPlan.sub_program_id,
          group_id: pastPlan.group_id,
          ai_plan_id: pastPlan.id,
          title: `${d.sessionType} — ${scopeLabel}`,
          event_type: (d.sessionType.toLowerCase().includes('race') ? 'race' : 'training') as 'race' | 'training',
          start_at: dateObj.toISOString(),
          end_at: endObj.toISOString(),
          notes: d.notes,
          created_by: user.id,
        }
      })

      const { error } = await supabase.from('events').insert(events)
      if (error) {
        console.error('Push past plan DB error:', error.message, error.code, error.details, error.hint)
        throw error
      }

      toast.success(`Schedule updated — ${events.length} sessions replaced`, { description: 'View them in the Schedule tab' })
    } catch (err) {
      const e = err as { message?: string }
      console.error('Push past plan error:', e?.message ?? String(err))
      toast.error(e?.message ? `Failed: ${e.message}` : 'Failed to push to schedule')
    }
  }

  if (aiEnabled === null) return <InlineLoading message="Loading…" />

  // AI not enabled
  if (!aiEnabled) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">AI Training Plan</h1>
          <p className="text-muted-foreground mt-1">Generate weekly training plans with AI</p>
        </div>
        <Card className="max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-secondary p-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">AI features are not enabled</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ask your club administrator to enable AI features under Settings → AI & Intelligence.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">AI Training Plan</h1>
            <Badge className="bg-purple-900/30 text-purple-400 border-purple-700 text-xs">Beta</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Generate weekly training plans with Claude AI.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('generate')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'generate'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="h-4 w-4" />
          Generate
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'history'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <History className="h-4 w-4" />
          Past Plans
        </button>
      </div>

      {activeTab === 'history' && (
        <HistoryTab
          plans={pastPlans}
          loading={pastPlansLoading}
          selected={selectedPastPlan}
          onSelect={(p) => setSelectedPastPlan(p)}
          onBack={() => setSelectedPastPlan(null)}
          onPlanUpdated={(updated) =>
            setPastPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p))
          }
          defaultStartTime={startTime}
          onPushToSchedule={handlePushPastPlan}
        />
      )}

      {activeTab === 'generate' && <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* ── Config panel ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Plan Setup</CardTitle>
            <CardDescription>Configure scope and context</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Season (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Season</Label>
              <div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
                {currentSeason?.name ?? 'No active season'}
              </div>
            </div>

            {/* Program */}
            <Select
              label="Program *"
              value={programId}
              onChange={setProgramId}
              options={programs}
              placeholder="Select program…"
            />

            {/* Sub-program */}
            <Select
              label="Sub-program"
              value={subProgramId}
              onChange={setSubProgramId}
              options={subPrograms}
              placeholder={programId ? 'Select sub-program…' : 'Select a program first'}
              disabled={!programId}
            />

            {/* Group */}
            <Select
              label="Group"
              value={groupId}
              onChange={setGroupId}
              options={groups}
              placeholder={subProgramId ? 'Select group…' : 'Select a sub-program first'}
              disabled={!subProgramId}
            />

            {/* Week start + session start time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="week-start" className="text-sm font-medium">Week starting</Label>
                <Input
                  id="week-start"
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start-time" className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Session start
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>

            {/* Focus */}
            <div className="space-y-1.5">
              <Label htmlFor="focus" className="text-sm font-medium">Coaching focus <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="focus"
                placeholder="e.g. Short-turn GS, edge angles, race prep…"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm font-medium">Additional context <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="notes"
                placeholder="Athlete level, injuries to work around, upcoming race, snow conditions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || !programId || !currentSeason?.id}
              className="w-full gap-2"
              size="lg"
            >
              {generating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Plan
                </>
              )}
            </Button>

            {generating && !streamingText && (
              <p className="text-xs text-center text-muted-foreground animate-pulse">
                Connecting to Claude…
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Plan output ── */}
        <div className="lg:col-span-3">
          {!plan && !generating && !streamingText && (
            <Card className="h-full min-h-[400px] border-dashed">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 text-center">
                <div className="rounded-full bg-purple-950/30 p-4">
                  <Sparkles className="h-8 w-8 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium">Your plan will appear here</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a program and click Generate Plan
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {(streamingText || plan) && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className={cn('h-4 w-4', generating ? 'text-purple-400 animate-pulse' : 'text-purple-500')} />
                      {generating ? 'Generating plan…' : 'Generated Plan'}
                    </CardTitle>
                    {plan && (
                      <CardDescription className="mt-1">
                        {[plan.context.program, plan.context.sub_program, plan.context.group]
                          .filter(Boolean)
                          .join(' › ')}{' '}
                        · Week of {new Date(plan.context.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </CardDescription>
                    )}
                  </div>
                  {plan && !generating && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => { setPlan(null); setPlanId(null); setPushedToSchedule(false) }} className="gap-1.5">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </Button>
                      {!editing ? (
                        <Button variant="outline" size="sm" onClick={() => { setEditedText(plan.text); setEditing(true) }} className="gap-1.5">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={handleSaveEdit} disabled={savingEdit} className="gap-1.5 border-green-700 text-green-400 hover:bg-green-950/30">
                          <Check className="h-3.5 w-3.5" />
                          {savingEdit ? 'Saving…' : 'Save edits'}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        onClick={handlePushToSchedule}
                        disabled={pushingToSchedule || pushedToSchedule || editing}
                        className={cn('gap-1.5', pushedToSchedule && 'bg-green-600 hover:bg-green-600')}
                      >
                        {pushedToSchedule ? (
                          <><Check className="h-3.5 w-3.5" /> Added to Schedule</>
                        ) : pushingToSchedule ? (
                          <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Pushing…</>
                        ) : (
                          <><CalendarPlus className="h-3.5 w-3.5" /> Push to Schedule</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="border-t pt-4 max-h-[70vh] overflow-y-auto">
                {editing ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Edit the plan below, then click Save edits. Changes won't be pushed to schedule until you save.</p>
                    <Textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="min-h-[50vh] font-mono text-xs resize-y"
                    />
                  </div>
                ) : (
                  <PlanDisplay text={generating ? streamingText : plan?.text ?? ''} />
                )}
                {generating && streamingText && (
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t text-xs text-purple-500">
                    <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                    Writing…
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>}
    </div>
  )
}
