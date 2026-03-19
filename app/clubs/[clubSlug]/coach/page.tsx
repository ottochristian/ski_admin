'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Users, Calendar, MessageSquare, ArrowRight, Clock, MapPin, Sparkles, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin-page-header'
import { cn } from '@/lib/utils'

type Profile = {
  id: string
  email: string
  first_name?: string | null
  role: string
  club_id?: string | null
}

type Coach = {
  id: string
  profile_id: string
}

type CoachAssignment = {
  id: string
  role?: string | null
  programs?: { name?: string | null } | null
  sub_programs?: { name?: string | null } | null
  groups?: { name?: string | null } | null
}

type TodayEvent = {
  id: string
  title: string
  event_type: string
  start_at: string
  end_at: string | null
  location: string | null
  sub_programs: { name: string } | null
}

const EVENT_TYPE_DOT: Record<string, string> = {
  training: 'bg-orange-500',
  race:     'bg-red-500',
  camp:     'bg-purple-500',
  meeting:  'bg-yellow-500',
  other:    'bg-zinc-400',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const getRoleLabel = (role?: string | null): string => {
  switch (role) {
    case 'head_coach':      return 'Head Coach'
    case 'assistant_coach': return 'Assistant Coach'
    case 'substitute_coach': return 'Substitute Coach'
    default:                return 'Coach'
  }
}

const getAssignmentDisplayName = (a: CoachAssignment): string =>
  a.groups?.name || a.sub_programs?.name || a.programs?.name || 'Unknown'

function CoachBriefingWidget({ date, aiEnabled }: { date: string; aiEnabled: boolean }) {
  const [generating, setGenerating] = useState(false)
  const [text, setText] = useState('')
  const [noSessions, setNoSessions] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!aiEnabled) return
    const cacheKey = `coach_briefing_${date}`

    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setText(cached)
        setFromCache(true)
        return
      }
    } catch {}

    generate()
  }, [aiEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setGenerating(true)
    setText('')
    setNoSessions(false)
    setExpanded(false)
    setFromCache(false)
    try {
      const res = await fetch('/api/coach/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (res.status === 404) { setNoSessions(true); return }
      if (!res.ok) return

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setText(accumulated)
      }
      try {
        localStorage.setItem(`coach_briefing_${date}`, accumulated)
      } catch {}
    } finally {
      setGenerating(false)
    }
  }

  function handleRefresh() {
    try { localStorage.removeItem(`coach_briefing_${date}`) } catch {}
    generate()
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const lines = text.split('\n')
  const wordCount = (str: string) => str.split(/\s+/).filter(Boolean).length
  let collapsedLines: string[] = []
  let words = 0
  for (const line of lines) {
    collapsedLines.push(line)
    words += wordCount(line)
    if (words >= 80) break
  }
  const isTruncated = !expanded && !generating && collapsedLines.length < lines.length
  const visibleLines = (expanded || generating) ? lines : collapsedLines

  function renderBold(str: string) {
    const parts = str.split(/\*\*(.+?)\*\*/)
    return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)
  }

  function renderLines(ls: string[]) {
    return ls.map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-2" />
      if (/^#{1,2} /.test(line)) return <p key={i} className="font-semibold text-foreground mt-3 first:mt-0">{line.replace(/^#{1,2} /, '')}</p>
      if (/^### /.test(line)) return <p key={i} className="font-medium text-zinc-300 mt-2">{line.replace(/^### /, '')}</p>
      if (/^---+$/.test(line.trim())) return <hr key={i} className="border-zinc-800 my-2" />
      if (/^[*-] /.test(line)) return (
        <div key={i} className="flex gap-1.5">
          <span className="text-orange-500 shrink-0 mt-0.5">•</span>
          <span>{renderBold(line.replace(/^[*-] /, ''))}</span>
        </div>
      )
      return <p key={i}>{renderBold(line)}</p>
    })
  }

  if (!aiEnabled) return null

  return (
    <div className="relative rounded-xl border border-orange-900/40 bg-zinc-900 overflow-hidden shadow-[0_0_50px_-15px_var(--glow-orange)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className={cn('h-4 w-4', generating ? 'text-orange-400 animate-pulse' : 'text-orange-500')} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {generating ? 'Generating briefing…' : `Today's Briefing`}
            </h3>
            <p className="text-xs text-zinc-400">
              {dateLabel}{fromCache && <span className="ml-1.5 text-zinc-300">· cached</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!generating && (
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
              title="Regenerate"
            >
              <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 text-sm text-zinc-300">
        {generating && !text && (
          <p className="text-muted-foreground animate-pulse text-xs">Analysing today's schedule…</p>
        )}
        {noSessions && (
          <p className="text-muted-foreground text-xs">No sessions assigned to you today.</p>
        )}
        {text && (
          <>
            <div className="prose prose-sm max-w-none text-zinc-300 space-y-1">
              {renderLines(visibleLines)}
              {generating && (
                <span className="inline-block w-1.5 h-3.5 bg-orange-500 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
            {isTruncated && (
              <button
                onClick={() => setExpanded(true)}
                className="mt-3 text-xs text-orange-500 hover:text-orange-400 font-medium"
              >
                Show more ↓
              </button>
            )}
            {expanded && lines.length > collapsedLines.length && (
              <button
                onClick={() => setExpanded(false)}
                className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 font-medium"
              >
                Show less ↑
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CoachDashboardPage() {
  const router = useRouter()
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/coach`
  const [supabase] = useState(() => createClient())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignments, setAssignments] = useState<CoachAssignment[]>([])
  const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([])
  const [aiEnabled, setAiEnabled] = useState(false)

  const date = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.push('/login'); return }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (profileError || !profileData || profileData.role !== 'coach') {
        router.push('/login'); return
      }
      setProfile(profileData as Profile)

      // Fetch AI status (coach-accessible endpoint)
      fetch('/api/ai/status')
        .then(r => r.json())
        .then(data => setAiEnabled(data.ai_enabled ?? false))
        .catch(() => {})

      const { data: coachData } = await supabase
        .from('coaches').select('*').eq('profile_id', user.id).single()

      if (coachData?.id) {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('coach_assignments')
          .select('id, role, programs(name), sub_programs(name), groups(name)')
          .eq('coach_id', coachData.id)

        if (!assignmentsError) {
          setAssignments((assignmentsData || []) as CoachAssignment[])
        }
      }

      // Today's schedule
      if (profileData.club_id) {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        const { data: eventsData } = await supabase
          .from('events')
          .select('id, title, event_type, start_at, end_at, location, sub_programs(name)')
          .eq('club_id', profileData.club_id)
          .gte('start_at', todayStart.toISOString())
          .lte('start_at', todayEnd.toISOString())
          .order('start_at', { ascending: true })

        setTodayEvents((eventsData as unknown as TodayEvent[]) ?? [])
      }

      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground mb-1">Something went wrong</p>
          <p className="text-sm text-zinc-500 mb-4">{error}</p>
          <Button size="sm" asChild><Link href={basePath}>Reload</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Header */}
      <AdminPageHeader
        title="Coach Dashboard"
        description={`Welcome, ${profile.first_name || profile.email}`}
      />

      {/* 2. Coach Briefing Widget */}
      <CoachBriefingWidget date={date} aiEnabled={aiEnabled} />

      {/* 3. Today's schedule */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Today's Schedule</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link href={`${basePath}/schedule`} className="text-xs text-orange-500 hover:underline">
            Full schedule →
          </Link>
        </div>

        {todayEvents.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Calendar className="h-7 w-7 text-zinc-200 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">No sessions scheduled for today</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {todayEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${EVENT_TYPE_DOT[ev.event_type] ?? 'bg-zinc-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                  {ev.sub_programs?.name && (
                    <p className="text-xs text-zinc-400 truncate">{ev.sub_programs.name}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {formatTime(ev.start_at)}{ev.end_at ? ` – ${formatTime(ev.end_at)}` : ''}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1 text-xs text-zinc-500 truncate">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {ev.location}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize flex-shrink-0
                  ${ev.event_type === 'race' ? 'bg-red-900/30 text-red-400' :
                    ev.event_type === 'camp' ? 'bg-purple-900/30 text-purple-400' :
                    ev.event_type === 'meeting' ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-orange-950/30 text-orange-400'}`}>
                  {ev.event_type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Assignments — full width grid */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-foreground">Your Assignments</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Programs and groups you're coaching</p>
        </div>

        {assignments.length > 0 ? (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assignments.map(assignment => (
              <div
                key={assignment.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-800/40 px-4 py-3 hover:bg-zinc-800/70 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{getAssignmentDisplayName(assignment)}</p>
                  {assignment.role && (
                    <span className="inline-flex mt-1 items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-950/40 text-orange-400 ring-1 ring-orange-900/40">
                      {getRoleLabel(assignment.role)}
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild className="mt-1 w-full">
                  <Link href={`${basePath}/assignments/${assignment.id}`}>View</Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-zinc-400">No assignments yet</p>
            <p className="text-xs text-zinc-300 mt-1">Contact an administrator to get assigned to a program</p>
          </div>
        )}
      </div>
    </div>
  )
}
