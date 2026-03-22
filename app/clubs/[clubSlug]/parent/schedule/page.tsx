'use client'

import { useState, useMemo, useEffect } from 'react'
import { useClub } from '@/lib/club-context'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { useEvents, type Event } from '@/lib/hooks/use-events'
import { useParentClub } from '@/lib/use-parent-club'
import { createClient } from '@/lib/supabase/client'
import { InlineLoading } from '@/components/ui/loading-states'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react'

// ─── colours ────────────────────────────────────────────────────────────────
const TYPE_CARD: Record<string, string> = {
  training: 'bg-blue-950/30 border-blue-800 text-blue-300',
  race:     'bg-red-950/20 border-red-800 text-red-300',
  camp:     'bg-purple-950/30 border-purple-800 text-purple-300',
  meeting:  'bg-yellow-950/30 border-yellow-800 text-yellow-300',
  other:    'bg-secondary border-border text-muted-foreground',
}
const TYPE_BADGE: Record<string, string> = {
  training: 'bg-blue-900/30 text-blue-400',
  race:     'bg-red-900/30 text-red-400',
  camp:     'bg-purple-900/30 text-purple-400',
  meeting:  'bg-yellow-900/30 text-yellow-400',
  other:    'bg-secondary text-muted-foreground',
}
const TYPE_DOT: Record<string, string> = {
  training: 'bg-blue-500',
  race:     'bg-red-500',
  camp:     'bg-purple-500',
  meeting:  'bg-yellow-500',
  other:    'bg-zinc-400',
}

// ─── date helpers ────────────────────────────────────────────────────────────
function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - r.getDay())
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function fmtDuration(start: string, end: string | null) {
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start)
}

const DAY_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_LETTER = ['S','M','T','W','T','F','S']
const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ─── mini calendar ────────────────────────────────────────────────────────────
function MiniCalendar({
  month, year, events, weekStart,
  onDayClick, onPrev, onNext,
}: {
  month: number; year: number
  events: Event[]
  weekStart: Date
  onDayClick: (d: Date) => void
  onPrev: () => void
  onNext: () => void
}) {
  const today = new Date()

  // Build set of days that have events: "YYYY-M-D" → Set of event_type
  const eventDays = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const e of events) {
      const d = new Date(e.start_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(e.event_type)
    }
    return map
  }, [events])

  // Days grid: pad from Sunday
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // current selected week bounds
  const weekEnd = addDays(weekStart, 6)

  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  // pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onPrev} className="p-1 rounded hover:bg-secondary/50 transition-colors">
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold">{MONTHS[month]} {year}</span>
        <button type="button" onClick={onNext} className="p-1 rounded hover:bg-secondary/50 transition-colors">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LETTER.map((l, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-zinc-400 py-0.5">{l}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />

          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
          const types = eventDays.get(key)
          const isToday = isSameDay(day, today)
          const inSelectedWeek = day >= weekStart && day <= weekEnd

          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(day)}
              className={`relative flex flex-col items-center py-1 rounded-md transition-colors text-xs font-medium
                ${inSelectedWeek ? 'bg-blue-950/30' : 'hover:bg-secondary/50'}
              `}
            >
              <span className={`w-6 h-6 flex items-center justify-center rounded-full leading-none
                ${isToday ? 'bg-blue-600 text-foreground' : inSelectedWeek ? 'text-blue-400' : 'text-muted-foreground'}
              `}>
                {day.getDate()}
              </span>
              {/* Event type dots */}
              {types && (
                <div className="flex gap-0.5 mt-0.5">
                  {[...types].slice(0, 3).map((t) => (
                    <div key={t} className={`w-1 h-1 rounded-full ${TYPE_DOT[t] ?? 'bg-zinc-400'}`} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(TYPE_DOT).map(([type, dot]) => (
          <div key={type} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className="text-[10px] text-zinc-400 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function ParentSchedulePage() {
  const { club } = useClub()
  const currentSeason = useCurrentSeason()
  const { athletes } = useParentClub()
  const { data: allEvents = [], isLoading } = useEvents(club?.id, currentSeason?.id)

  // Fetch sub_program_ids the household's athletes are registered for
  const [enrolledSubProgramIds, setEnrolledSubProgramIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!currentSeason?.id || !athletes?.length) return
    const athleteIds = athletes.map((a) => a.id)
    const supabase = createClient()
    supabase
      .from('registrations')
      .select('sub_program_id')
      .in('athlete_id', athleteIds)
      .eq('season_id', currentSeason.id)
      .in('status', ['confirmed', 'pending', 'waitlisted'])
      .then(({ data }) => {
        const ids = new Set<string>()
        for (const r of data ?? []) {
          if (r.sub_program_id) ids.add(r.sub_program_id)
        }
        setEnrolledSubProgramIds(ids)
      })
  }, [currentSeason?.id, athletes])

  // Only show: club-wide events (no sub_program_id) + events for enrolled sub-programs
  const events = useMemo(
    () => allEvents.filter(
      (e) => e.sub_program_id === null || enrolledSubProgramIds.has(e.sub_program_id)
    ),
    [allEvents, enrolledSubProgramIds]
  )

  const today = useMemo(() => new Date(), [])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [calMonth, setCalMonth] = useState(() => ({ month: today.getMonth(), year: today.getFullYear() }))

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekEvents = useMemo(() => events.filter((e) => weekDays.some((d) => isSameDay(new Date(e.start_at), d))), [events, weekDays])

  function goToDay(d: Date) {
    setWeekStart(startOfWeek(d))
    setCalMonth({ month: d.getMonth(), year: d.getFullYear() })
  }
  function prevWeek() {
    const next = addDays(weekStart, -7)
    setWeekStart(next)
    setCalMonth({ month: next.getMonth(), year: next.getFullYear() })
  }
  function nextWeek() {
    const next = addDays(weekStart, 7)
    setWeekStart(next)
    setCalMonth({ month: next.getMonth(), year: next.getFullYear() })
  }
  function goToday() {
    const now = new Date()
    setWeekStart(startOfWeek(now))
    setCalMonth({ month: now.getMonth(), year: now.getFullYear() })
  }

  const weekLabel = `${fmtShort(weekStart)} – ${fmtShort(addDays(weekStart, 6))}, ${weekStart.getFullYear()}`
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(today))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Schedule</h1>
        <p className="text-muted-foreground mt-1">
          {currentSeason?.name ?? 'All events'}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* ── Mini calendar sidebar ── */}
        <div className="w-full md:w-56 md:flex-shrink-0 flex flex-col gap-3">
          <MiniCalendar
            month={calMonth.month}
            year={calMonth.year}
            events={events}
            weekStart={weekStart}
            onDayClick={goToDay}
            onPrev={() => {
              const d = new Date(calMonth.year, calMonth.month - 1, 1)
              setCalMonth({ month: d.getMonth(), year: d.getFullYear() })
            }}
            onNext={() => {
              const d = new Date(calMonth.year, calMonth.month + 1, 1)
              setCalMonth({ month: d.getMonth(), year: d.getFullYear() })
            }}
          />
          <Button
            variant={isCurrentWeek ? 'outline' : 'default'}
            size="sm"
            className="w-full"
            onClick={goToday}
            disabled={isCurrentWeek}
          >
            This week
          </Button>
        </div>

        {/* ── Weekly view ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Week nav */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={prevWeek} className="p-1.5 rounded-md border border-border bg-card hover:bg-secondary/50 transition-colors shadow-sm">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold flex-1 text-center">{weekLabel}</span>
            <button type="button" onClick={nextWeek} className="p-1.5 rounded-md border border-border bg-card hover:bg-secondary/50 transition-colors shadow-sm">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="ml-2 text-xs text-muted-foreground">
              {weekEvents.length} event{weekEvents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {isLoading ? <InlineLoading /> : (
            <>
              {/* 7-col day grid — hidden on mobile, too narrow to be readable */}
              <div className="hidden md:grid grid-cols-7 gap-1.5">
                {weekDays.map((day) => {
                  const dayEvents = events.filter((e) => isSameDay(new Date(e.start_at), day))
                  const isToday = isSameDay(day, today)
                  return (
                    <div key={day.toISOString()} className="flex flex-col gap-1 min-h-[90px]">
                      <div className="text-center pb-1 border-b border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{DAY_SHORT[day.getDay()]}</p>
                        <div className={`mx-auto w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mt-0.5 ${isToday ? 'bg-blue-600 text-foreground' : ''}`}>
                          {day.getDate()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {dayEvents.length === 0
                          ? <p className="text-[10px] text-center text-muted-foreground mt-2">—</p>
                          : dayEvents.map((ev) => (
                            <div key={ev.id} className={`rounded border px-1.5 py-1 text-[10px] leading-tight ${TYPE_CARD[ev.event_type]}`}>
                              <p className="font-semibold truncate">{ev.title}</p>
                              <p className="opacity-60">{fmtTime(ev.start_at)}</p>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Event detail list */}
              {weekEvents.length > 0 ? (
                <div className="flex flex-col gap-3 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</p>
                  {weekDays.map((day) => {
                    const dayEvents = events.filter((e) => isSameDay(new Date(e.start_at), day))
                    if (!dayEvents.length) return null
                    return (
                      <div key={day.toISOString()}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                          {DAY_FULL[day.getDay()]}, {fmtShort(day)}
                        </p>
                        <div className="flex flex-col gap-2">
                          {dayEvents.map((ev) => (
                            <div key={ev.id} className={`rounded-xl border p-4 ${TYPE_CARD[ev.event_type]}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm">{ev.title}</p>
                                  {ev.sub_programs && (
                                    <p className="text-xs opacity-60 mt-0.5">
                                      {ev.sub_programs.programs?.name ? `${ev.sub_programs.programs.name} — ` : ''}
                                      {ev.sub_programs.name}
                                    </p>
                                  )}
                                </div>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 capitalize ${TYPE_BADGE[ev.event_type]}`}>
                                  {ev.event_type}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-3 mt-2 text-xs opacity-70">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {fmtDuration(ev.start_at, ev.end_at)}
                                </span>
                                {ev.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {ev.location}
                                  </span>
                                )}
                              </div>
                              {ev.notes && <p className="text-xs mt-2 opacity-60 leading-relaxed">{ev.notes}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No events this week.</p>
                  <p className="text-xs mt-1">Pick a day on the calendar to jump to another week.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
