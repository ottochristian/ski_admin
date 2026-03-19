'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useClub } from '@/lib/club-context'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin-page-header'
import Link from 'next/link'
import {
  ArrowLeft, Users, Calendar, MessageSquare, Sparkles,
  Clock, MapPin, ChevronRight,
} from 'lucide-react'

type Assignment = {
  id: string
  role: string | null
  program_id: string | null
  sub_program_id: string | null
  group_id: string | null
  programs: { id: string; name: string } | null
  sub_programs: { id: string; name: string } | null
  groups: { id: string; name: string } | null
}

type Athlete = {
  id: string
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  gender: string | null
}

type Event = {
  id: string
  title: string
  event_type: string
  start_at: string
  end_at: string | null
  location: string | null
}

const ROLE_LABELS: Record<string, string> = {
  head_coach: 'Head Coach',
  assistant_coach: 'Assistant Coach',
  substitute_coach: 'Substitute Coach',
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  training: 'bg-blue-900/30 text-blue-400',
  race:     'bg-red-900/30 text-red-400',
  camp:     'bg-purple-900/30 text-purple-400',
  meeting:  'bg-yellow-900/30 text-yellow-400',
  other:    'bg-zinc-800 text-zinc-400',
}

function calcAge(dob: string | null): string {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)))
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function AssignmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const assignmentId = params.assignmentId as string
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/coach`
  const { club } = useClub()
  const currentSeason = useCurrentSeason()
  const [supabase] = useState(() => createClient())

  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])

  useEffect(() => {
    if (!club?.id || !currentSeason?.id || !assignmentId) return

    async function load() {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('coach_assignments')
        .select('id, role, program_id, sub_program_id, group_id, programs(id, name), sub_programs(id, name), groups(id, name)')
        .eq('id', assignmentId)
        .single()

      if (assignmentError || !assignmentData) {
        router.push(basePath)
        return
      }

      setAssignment(assignmentData as unknown as Assignment)

      const subProgramIds = new Set<string>()

      if (assignmentData.sub_program_id) {
        subProgramIds.add(assignmentData.sub_program_id)
      } else if (assignmentData.program_id) {
        const { data: sps } = await supabase
          .from('sub_programs')
          .select('id')
          .eq('program_id', assignmentData.program_id)
        sps?.forEach((sp: any) => subProgramIds.add(sp.id))
      }

      if (subProgramIds.size > 0) {
        const query = supabase
          .from('registrations')
          .select('athletes!inner(id, first_name, last_name, date_of_birth, gender)')
          .in('sub_program_id', Array.from(subProgramIds))
          .eq('season_id', currentSeason!.id)
          .eq('club_id', club!.id)
          .eq('status', 'confirmed')

        if (assignmentData.group_id) {
          query.eq('group_id', assignmentData.group_id)
        }

        const { data: regs } = await query

        const athleteMap = new Map<string, Athlete>()
        regs?.forEach((reg: any) => {
          const a = reg.athletes
          if (a && !athleteMap.has(a.id)) athleteMap.set(a.id, a)
        })
        setAthletes(Array.from(athleteMap.values()).sort((a, b) =>
          `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
        ))

        const { data: events } = await supabase
          .from('events')
          .select('id, title, event_type, start_at, end_at, location')
          .eq('club_id', club!.id)
          .in('sub_program_id', Array.from(subProgramIds))
          .gte('start_at', new Date().toISOString())
          .order('start_at', { ascending: true })
          .limit(5)

        setUpcomingEvents((events as Event[]) ?? [])
      }

      setLoading(false)
    }

    load()
  }, [club?.id, currentSeason?.id, assignmentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    )
  }

  if (!assignment) return null

  const assignmentName =
    assignment.groups?.name ||
    assignment.sub_programs?.name ||
    assignment.programs?.name ||
    'Assignment'

  const breadcrumb = [
    assignment.programs?.name,
    assignment.sub_programs?.name,
    assignment.groups?.name,
  ].filter(Boolean).join(' › ')

  return (
    <div className="flex flex-col gap-6">
      {/* Back + Header */}
      <div>
        <Link href={basePath} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 mb-4 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
        <AdminPageHeader
          title={assignmentName}
          description={breadcrumb !== assignmentName ? breadcrumb : undefined}
        />
        {assignment.role && (
          <span className="mt-2 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-orange-950/40 text-orange-400 ring-1 ring-orange-900/40">
            {ROLE_LABELS[assignment.role] ?? assignment.role}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href={`${basePath}/messages`}
          className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 hover:bg-zinc-800/60 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-900/30 flex items-center justify-center shrink-0">
            <MessageSquare className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Message Group</p>
            <p className="text-xs text-zinc-400">Send to athletes & parents</p>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </Link>

        <Link
          href={`${basePath}/schedule`}
          className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 hover:bg-zinc-800/60 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-orange-900/30 flex items-center justify-center shrink-0">
            <Calendar className="h-4 w-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Schedule</p>
            <p className="text-xs text-zinc-400">View & manage sessions</p>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </Link>

        <Link
          href={`${basePath}/training-plan`}
          className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 hover:bg-zinc-800/60 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-900/30 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">AI Training Plan</p>
            <p className="text-xs text-zinc-400">Generate a weekly plan</p>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roster */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-zinc-400" />
                Roster
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">{athletes.length} athlete{athletes.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {athletes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-zinc-400">No confirmed athletes found</p>
              <p className="text-xs text-zinc-500 mt-1">Athletes appear once they have a confirmed registration</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {athletes.map((athlete) => (
                <div key={athlete.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0">
                    {(athlete.first_name?.[0] ?? '?')}{(athlete.last_name?.[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {athlete.first_name} {athlete.last_name}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Age {calcAge(athlete.date_of_birth)}
                      {athlete.gender ? ` · ${athlete.gender.charAt(0).toUpperCase() + athlete.gender.slice(1)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming events */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-400" />
              Upcoming Sessions
            </h3>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-zinc-400">No upcoming sessions</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {upcomingEvents.map((ev) => (
                <div key={ev.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium text-foreground leading-snug">{ev.title}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize shrink-0 ${EVENT_TYPE_COLORS[ev.event_type] ?? EVENT_TYPE_COLORS.other}`}>
                      {ev.event_type}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Clock className="h-3 w-3 text-zinc-500 shrink-0" />
                      {formatDate(ev.start_at)} · {formatTime(ev.start_at)}
                      {ev.end_at ? ` – ${formatTime(ev.end_at)}` : ''}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                        {ev.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-5 py-3 border-t border-zinc-800">
            <Link href={`${basePath}/schedule`} className="text-xs text-orange-500 hover:text-orange-400 font-medium">
              Full schedule →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
