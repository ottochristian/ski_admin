'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClub } from '@/lib/club-context'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  type Event,
  type CreateEventInput,
} from '@/lib/hooks/use-events'
import { Button } from '@/components/ui/button'
import { InlineLoading } from '@/components/ui/loading-states'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Save, Upload, Download, CheckCircle2, AlertCircle, Clock, MapPin } from 'lucide-react'
import { toast } from 'sonner'

const EVENT_TYPE_COLORS: Record<string, string> = {
  training: 'bg-blue-900/30 text-blue-400 border-blue-800',
  race:     'bg-red-900/30 text-red-400 border-red-800',
  camp:     'bg-purple-900/30 text-purple-400 border-purple-800',
  meeting:  'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  other:    'bg-secondary text-muted-foreground border-border',
}

const EVENT_TYPE_DOT: Record<string, string> = {
  training: 'bg-blue-500',
  race:     'bg-red-500',
  camp:     'bg-purple-500',
  meeting:  'bg-yellow-500',
  other:    'bg-zinc-400',
}

type SubProgram = { id: string; name: string; programs: { name: string; season_id: string } | null }
type Group = { id: string; name: string; sub_program_id: string }

type ImportRow = {
  title: string
  event_type: string
  sub_program_name: string
  date: string        // YYYY-MM-DD
  start_time: string  // HH:MM
  end_time: string    // HH:MM
  location: string
  notes: string
  // resolved after matching
  sub_program_id?: string | null
  valid: boolean
  error?: string
}

const CSV_TEMPLATE_HEADERS = 'Title,Type,Sub-Program,Date (YYYY-MM-DD),Start Time (HH:MM),End Time (HH:MM),Location,Notes'
const CSV_TEMPLATE_EXAMPLE = [
  '"Beginner Alpine Training","training","Alpine Skiing - Beginner","2026-03-18","09:00","12:00","Jackson Hole Mountain Resort","Meet at gondola base"',
  '"U14 GS Race","race","Alpine Skiing - Advanced","2026-03-22","09:00","15:00","Race Arena","Bib pickup Friday 5pm"',
  '"Team Meeting","meeting","","2026-03-25","18:00","19:00","Clubhouse","Season review - all programs"',
].join('\n')

function downloadTemplate() {
  const content = `${CSV_TEMPLATE_HEADERS}\n${CSV_TEMPLATE_EXAMPLE}`
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'schedule-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cell += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim()); cell = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some(c => c)) rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(c => c)) rows.push(row) }
  return rows
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LETTER = ['S','M','T','W','T','F','S']

// Per-program colour palette — borders + pill accents
const PROGRAM_PALETTE = [
  { border: 'border-l-blue-500',    pill: 'bg-blue-900/30 text-blue-400 ring-blue-700',    dot: 'bg-blue-500'    },
  { border: 'border-l-emerald-500', pill: 'bg-emerald-900/30 text-emerald-400 ring-emerald-700', dot: 'bg-emerald-500' },
  { border: 'border-l-orange-500',  pill: 'bg-orange-900/30 text-orange-400 ring-orange-700',  dot: 'bg-orange-500'  },
  { border: 'border-l-violet-500',  pill: 'bg-violet-900/30 text-violet-400 ring-violet-700',  dot: 'bg-violet-500'  },
  { border: 'border-l-pink-500',    pill: 'bg-pink-900/30 text-pink-400 ring-pink-700',    dot: 'bg-pink-500'    },
  { border: 'border-l-teal-500',    pill: 'bg-teal-900/30 text-teal-400 ring-teal-700',    dot: 'bg-teal-500'    },
  { border: 'border-l-amber-500',   pill: 'bg-amber-900/30 text-amber-400 ring-amber-700',   dot: 'bg-amber-500'   },
]
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weekEnd = addDays(weekStart, 6)
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-xl border bg-zinc-900 border-zinc-800 p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onPrev} className="p-1 rounded hover:bg-zinc-800 transition-colors">
          <ChevronLeft className="h-4 w-4 text-zinc-400" />
        </button>
        <span className="text-sm font-semibold text-foreground">{MONTHS[month]} {year}</span>
        <button type="button" onClick={onNext} className="p-1 rounded hover:bg-zinc-800 transition-colors">
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_LETTER.map((l, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-zinc-500 py-0.5">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
          const types = eventDays.get(key)
          const isToday = isSameDay(day, today)
          const inWeek = day >= weekStart && day <= weekEnd
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(day)}
              className="flex flex-col items-center py-1 rounded-md transition-colors text-xs font-medium hover:bg-zinc-800/50"
            >
              <span className={`w-6 h-6 flex items-center justify-center rounded-full leading-none
                ${isToday ? 'bg-blue-600 text-white' : inWeek ? 'text-zinc-200 font-semibold' : 'text-zinc-400'}
              `}>
                {day.getDate()}
              </span>
              {types && (
                <div className="flex gap-0.5 mt-0.5">
                  {[...types].slice(0, 3).map((t) => (
                    <div key={t} className={`w-1 h-1 rounded-full ${EVENT_TYPE_DOT[t] ?? 'bg-zinc-400'}`} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const emptyForm = (): Omit<CreateEventInput, 'club_id'> => ({
  title: '',
  event_type: 'training',
  location: '',
  start_at: '',
  end_at: '',
  notes: '',
  sub_program_id: null,
  group_id: null,
  season_id: null,
})

export default function CoachSchedulePage() {
  const { club } = useClub()
  const currentSeason = useCurrentSeason()
  const [supabase] = useState(() => createClient())

  const { data: events = [], isLoading } = useEvents(club?.id, currentSeason?.id)
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()

  const today = useMemo(() => new Date(), [])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [calMonth, setCalMonth] = useState(() => ({ month: today.getMonth(), year: today.getFullYear() }))
  const [filterSpId, setFilterSpId] = useState<string | null>(null)

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
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(today))
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([])
  const [assignedSpIds, setAssignedSpIds] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Group[]>([])

  // Detail panel (click to view)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  // Add/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  // Import dialog
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)

  // Load only the sub_programs this coach is assigned to for the current season.
  // Assignments can be at program, sub_program, or group level — all resolve to sub_programs.
  useEffect(() => {
    if (!club?.id || !currentSeason?.id) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: coachRow } = await supabase
        .from('coaches').select('id').eq('profile_id', user.id).single()
      if (!coachRow) return

      const { data: assignments } = await supabase
        .from('coach_assignments')
        .select('program_id, sub_program_id, group_id')
        .eq('coach_id', coachRow.id)
        .is('deleted_at', null)

      if (!assignments?.length) {
        setSubPrograms([])
        setAssignedSpIds(new Set())
        return
      }

      const directSpIds = new Set(assignments.map(a => a.sub_program_id).filter(Boolean) as string[])
      const progIds = assignments.map(a => a.program_id).filter(Boolean) as string[]
      const groupIds = assignments.map(a => a.group_id).filter(Boolean) as string[]

      // Resolve group-level assignments → their sub_program_id
      if (groupIds.length) {
        const { data: groupRows } = await supabase
          .from('groups')
          .select('sub_program_id')
          .in('id', groupIds)
        groupRows?.forEach((g: any) => { if (g.sub_program_id) directSpIds.add(g.sub_program_id) })
      }

      // Fetch all sub_programs for this season
      const { data: allSPs } = await supabase
        .from('sub_programs')
        .select('id, name, programs!inner(name, season_id)')
        .eq('programs.season_id', currentSeason!.id)
        .order('name')

      const allSPsTyped = (allSPs as unknown as SubProgram[]) ?? []

      // Include sub_programs that are directly assigned OR belong to an assigned program
      const assignedSPs = allSPsTyped.filter(sp =>
        directSpIds.has(sp.id) ||
        (sp.programs && progIds.includes((sp.programs as any).id ?? ''))
      )

      setSubPrograms(assignedSPs)
      setAssignedSpIds(new Set(assignedSPs.map(sp => sp.id)))
    }
    load()
  }, [club?.id, currentSeason?.id])

  // Load groups when sub_program selection changes in the form
  useEffect(() => {
    if (!form.sub_program_id) { setGroups([]); return }
    supabase
      .from('groups')
      .select('id, name, sub_program_id')
      .eq('sub_program_id', form.sub_program_id)
      .then(({ data }) => setGroups((data as Group[]) ?? []))
  }, [form.sub_program_id])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function eventsOnDay(day: Date) {
    return events.filter((e) => {
      if (!isSameDay(new Date(e.start_at), day)) return false
      if (filterSpId && e.sub_program_id !== filterSpId) return false
      return true
    })
  }

  function openAdd(day?: Date) {
    setEditingId(null)
    const base = day ? new Date(day) : new Date()
    base.setHours(9, 0, 0, 0)
    const end = new Date(base)
    end.setHours(10, 0, 0, 0)
    setForm({
      ...emptyForm(),
      season_id: currentSeason?.id ?? null,
      start_at: toLocalInput(base),
      end_at: toLocalInput(end),
    })
    setDialogOpen(true)
  }

  function openEdit(ev: Event) {
    setEditingId(ev.id)
    setForm({
      title: ev.title,
      event_type: ev.event_type,
      location: ev.location ?? '',
      start_at: toLocalInput(new Date(ev.start_at)),
      end_at: ev.end_at ? toLocalInput(new Date(ev.end_at)) : '',
      notes: ev.notes ?? '',
      sub_program_id: ev.sub_program_id,
      group_id: ev.group_id,
      season_id: ev.season_id,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.start_at || !club?.id) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        location: form.location?.trim() || null,
        notes: form.notes?.trim() || null,
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        season_id: currentSeason?.id ?? null,
      }
      if (editingId) {
        await updateEvent.mutateAsync({ id: editingId, updates: payload })
        toast.success('Event updated')
      } else {
        await createEvent.mutateAsync({ ...payload, club_id: club.id })
        toast.success('Event created')
      }
      setDialogOpen(false)
    } catch {
      toast.error('Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return
    try {
      await deleteEvent.mutateAsync(id)
      toast.success('Event deleted')
    } catch {
      toast.error('Failed to delete event')
    }
  }

  const weekLabel = `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`

  // Build colour map: sub_program_id → palette entry (stable by index in subPrograms list)
  const spColorMap = useMemo(() => {
    const map = new Map<string, typeof PROGRAM_PALETTE[0]>()
    subPrograms.forEach((sp, i) => {
      map.set(sp.id, PROGRAM_PALETTE[i % PROGRAM_PALETTE.length])
    })
    return map
  }, [subPrograms])

  // Group sub_programs by parent program name for the filter bar
  const spByProgram = useMemo(() => {
    const map = new Map<string, SubProgram[]>()
    for (const sp of subPrograms) {
      const prog = sp.programs?.name ?? 'Other'
      if (!map.has(prog)) map.set(prog, [])
      map.get(prog)!.push(sp)
    }
    return map
  }, [subPrograms])

  // Active filter label for the header subtitle
  const activeFilter = filterSpId
    ? subPrograms.find(sp => sp.id === filterSpId)
    : null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground mt-1">
            {activeFilter
              ? <><span className="font-medium">{activeFilter.programs?.name ?? ''}</span> — {activeFilter.name}</>
              : 'All programs'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => openAdd()} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Program filter bar */}
      {subPrograms.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setFilterSpId(null)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ring-1
              ${filterSpId === null
                ? 'bg-zinc-900 text-foreground ring-zinc-900'
                : 'bg-card text-muted-foreground ring-border hover:bg-secondary/50'}`}
          >
            All programs
          </button>

          {[...spByProgram.entries()].map(([progName, sps]) => (
            <div key={progName} className="flex items-center gap-1">
              <span className="text-xs text-zinc-400 font-medium">{progName}</span>
              <span className="text-zinc-300 text-xs">›</span>
              {sps.map((sp) => {
                const colors = spColorMap.get(sp.id)!
                const isActive = filterSpId === sp.id
                const isAssigned = assignedSpIds.has(sp.id)
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setFilterSpId(isActive ? null : sp.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ring-1
                      ${isActive ? `${colors.pill} ring-current` : 'bg-card text-muted-foreground ring-border hover:bg-secondary/50'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                    {sp.name}
                    {isAssigned && <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* Mini calendar sidebar */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3">
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
            variant="outline"
            size="sm"
            className="w-full"
            onClick={goToday}
            disabled={isCurrentWeek}
          >
            This week
          </Button>
          {/* Legend */}
          <div className="flex flex-col gap-1.5 px-1">
            {Object.entries(EVENT_TYPE_DOT).map(([type, dot]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="text-xs text-muted-foreground capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly view */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Week nav */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={prevWeek} className="p-1.5 rounded-md border border-border bg-card hover:bg-secondary/50 transition-colors shadow-sm">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold min-w-[180px] text-center">{weekLabel}</span>
            <button type="button" onClick={nextWeek} className="p-1.5 rounded-md border border-border bg-card hover:bg-secondary/50 transition-colors shadow-sm">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

      {isLoading ? <InlineLoading /> : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayEvents = eventsOnDay(day)
            const isToday = isSameDay(day, today)
            return (
              <div key={day.toISOString()} className="flex flex-col gap-1.5 min-h-[140px]">
                {/* Day header */}
                <div className="text-center pb-1 border-b border-border">
                  <p className="text-xs text-muted-foreground">{DAYS[day.getDay()]}</p>
                  <div className={`mx-auto w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mt-0.5 ${isToday ? 'bg-blue-600 text-white' : ''}`}>
                    {day.getDate()}
                  </div>
                </div>

                {/* Events */}
                <div className="flex flex-col gap-1 flex-1">
                  {dayEvents.map((ev) => {
                    const spColors = ev.sub_program_id ? spColorMap.get(ev.sub_program_id) : undefined
                    const isSelected = selectedEvent?.id === ev.id
                    return (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEvent(isSelected ? null : ev)}
                        className={`group relative rounded-md border-l-[3px] border pl-2 pr-2 py-1.5 text-xs cursor-pointer transition-all bg-card
                          ${spColors ? spColors.border : 'border-l-zinc-600'}
                          ${isSelected ? 'ring-1 ring-blue-500/60 shadow-md' : 'hover:shadow-sm hover:brightness-110'}`}
                      >
                        {/* Program label */}
                        {ev.sub_programs && (
                          <p className="text-[9px] font-semibold uppercase tracking-wide truncate mb-0.5 opacity-60">
                            {ev.sub_programs.name}
                          </p>
                        )}
                        <p className="font-medium truncate pr-6">{ev.title}</p>
                        <p className="text-[10px] opacity-50 mt-0.5">{formatTime(ev.start_at)}</p>
                        {/* Actions — stop propagation so they don't trigger detail panel */}
                        <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEdit(ev) }}
                            className="p-0.5 rounded hover:bg-secondary"
                          >
                            <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(ev.id) }}
                            className="p-0.5 rounded hover:bg-secondary"
                          >
                            <Trash2 className="h-2.5 w-2.5 text-zinc-500" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add to this day */}
                <button
                  type="button"
                  onClick={() => openAdd(day)}
                  className="text-[10px] text-muted-foreground hover:text-foreground text-center py-1 rounded hover:bg-secondary/50 transition-colors"
                >
                  + add
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail popup */}
      {selectedEvent && !dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[70vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize shrink-0 border ${EVENT_TYPE_COLORS[selectedEvent.event_type] ?? EVENT_TYPE_COLORS.other}`}>
                    {selectedEvent.event_type}
                  </span>
                  {selectedEvent.sub_programs?.name && (
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide truncate">{selectedEvent.sub_programs.name}</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-foreground leading-snug">{selectedEvent.title}</h3>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button
                  type="button"
                  onClick={() => { openEdit(selectedEvent); setSelectedEvent(null) }}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { handleDelete(selectedEvent.id); setSelectedEvent(null) }}
                  className="p-1.5 rounded hover:bg-zinc-800 text-red-500/70 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 transition-colors"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="px-4 py-3 flex flex-col gap-2.5 overflow-y-auto text-sm text-zinc-300">
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  {new Date(selectedEvent.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  {' · '}
                  {formatTime(selectedEvent.start_at)}
                  {selectedEvent.end_at ? ` – ${formatTime(selectedEvent.end_at)}` : ''}
                </span>
                {selectedEvent.location && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    {selectedEvent.location}
                  </span>
                )}
              </div>
              {selectedEvent.notes && (
                <p className="text-xs text-zinc-300 whitespace-pre-line border-t border-zinc-800 pt-2.5 leading-relaxed">{selectedEvent.notes}</p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Add/Edit dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{editingId ? 'Edit Event' : 'New Event'}</h2>
              <button type="button" onClick={() => setDialogOpen(false)}>
                <X className="h-4 w-4 text-zinc-400 hover:text-zinc-700" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Title */}
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Event title *"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              />

              {/* Type */}
              <select
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.event_type}
                onChange={(e) => setForm(f => ({ ...f, event_type: e.target.value as Event['event_type'] }))}
              >
                <option value="training">Training</option>
                <option value="race">Race</option>
                <option value="camp">Camp</option>
                <option value="meeting">Meeting</option>
                <option value="other">Other</option>
              </select>

              {/* Sub-program */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Program / Sub-program
                  {assignedSpIds.size > 0 && (
                    <span className="ml-1.5 text-[10px] text-emerald-600">✓ = your assignments</span>
                  )}
                </label>
                <select
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.sub_program_id ?? ''}
                  onChange={(e) => setForm(f => ({ ...f, sub_program_id: e.target.value || null, group_id: null }))}
                >
                  <option value="">— Club-wide (no specific program) —</option>
                  {subPrograms.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {assignedSpIds.has(sp.id) ? '✓ ' : ''}
                      {sp.programs?.name ? `${sp.programs.name} — ` : ''}{sp.name}
                    </option>
                  ))}
                </select>
              </div>

              {groups.length > 0 && (
                <select
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.group_id ?? ''}
                  onChange={(e) => setForm(f => ({ ...f, group_id: e.target.value || null }))}
                >
                  <option value="">All groups</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}

              {/* Start / End */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Start *</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.start_at}
                    onChange={(e) => setForm(f => ({ ...f, start_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">End</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.end_at ?? ''}
                    onChange={(e) => setForm(f => ({ ...f, end_at: e.target.value }))}
                  />
                </div>
              </div>

              {/* Location */}
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Location"
                value={form.location ?? ''}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              />

              {/* Notes */}
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Notes"
                rows={3}
                value={form.notes ?? ''}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.start_at} className="gap-2">
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
        </div> {/* end weekly view flex-1 */}
      </div> {/* end flex gap-6 sidebar+content */}

      {/* ── CSV Import modal ── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl flex flex-col gap-4 max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6">
              <h2 className="font-semibold text-lg">Import Schedule from CSV</h2>
              <button type="button" onClick={() => { setImportOpen(false); setImportRows([]) }}>
                <X className="h-4 w-4 text-zinc-400 hover:text-zinc-700" />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-6 pb-6 overflow-y-auto">
              {/* Step 1: Download template */}
              <div className="rounded-lg border border-blue-800 bg-blue-950/30 p-4 flex items-start gap-3">
                <Download className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-300">Step 1 — Download the template</p>
                  <p className="text-xs text-blue-400 mt-0.5">Fill in your schedule using the CSV template, then upload it below.</p>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 underline underline-offset-2"
                  >
                    <Download className="h-3 w-3" />
                    Download schedule-template.csv
                  </button>
                </div>
              </div>

              {/* Step 2: Upload */}
              <div>
                <p className="text-sm font-medium mb-2">Step 2 — Upload your filled CSV</p>
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary py-8 cursor-pointer hover:border-blue-600 hover:bg-blue-950/20 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to select a CSV file</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string
                        const rows = parseCSV(text)
                        if (!rows.length) return
                        // Skip header row
                        const data = rows.slice(1)
                        const parsed: ImportRow[] = data.map((cols) => {
                          const [title, event_type, sub_program_name, date, start_time, end_time, location, notes] = cols
                          const validTypes = ['training', 'race', 'camp', 'meeting', 'other']
                          const type = (event_type || 'training').toLowerCase().trim()
                          let error: string | undefined
                          if (!title?.trim()) error = 'Missing title'
                          else if (!validTypes.includes(type)) error = `Invalid type "${type}"`
                          else if (!date?.match(/^\d{4}-\d{2}-\d{2}$/)) error = 'Date must be YYYY-MM-DD'
                          else if (!start_time?.match(/^\d{2}:\d{2}$/)) error = 'Start time must be HH:MM'
                          const spMatch = subPrograms.find(sp =>
                            sp.name.toLowerCase().trim() === (sub_program_name || '').toLowerCase().trim()
                          )
                          return {
                            title: title?.trim() ?? '',
                            event_type: type,
                            sub_program_name: sub_program_name?.trim() ?? '',
                            date: date?.trim() ?? '',
                            start_time: start_time?.trim() ?? '',
                            end_time: end_time?.trim() ?? '',
                            location: location?.trim() ?? '',
                            notes: notes?.trim() ?? '',
                            sub_program_id: sub_program_name?.trim() ? (spMatch?.id ?? null) : null,
                            valid: !error && (sub_program_name?.trim() === '' || !!spMatch),
                            error: error ?? (sub_program_name?.trim() && !spMatch ? `Sub-program "${sub_program_name}" not found` : undefined),
                          }
                        })
                        setImportRows(parsed)
                      }
                      reader.readAsText(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

              {/* Preview */}
              {importRows.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Preview — {importRows.filter(r => r.valid).length} valid, {importRows.filter(r => !r.valid).length} with errors
                  </p>
                  <div className="rounded-lg border overflow-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary border-b sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-zinc-500 w-6"></th>
                          <th className="text-left px-3 py-2 font-medium text-zinc-500">Title</th>
                          <th className="text-left px-3 py-2 font-medium text-zinc-500">Type</th>
                          <th className="text-left px-3 py-2 font-medium text-zinc-500">Sub-Program</th>
                          <th className="text-left px-3 py-2 font-medium text-zinc-500">Date</th>
                          <th className="text-left px-3 py-2 font-medium text-zinc-500">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importRows.map((row, i) => (
                          <tr key={i} className={row.valid ? '' : 'bg-red-950/20'}>
                            <td className="px-3 py-1.5">
                              {row.valid
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                : <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                            </td>
                            <td className="px-3 py-1.5 font-medium text-foreground max-w-[140px] truncate">{row.title}</td>
                            <td className="px-3 py-1.5 capitalize text-muted-foreground">{row.event_type}</td>
                            <td className="px-3 py-1.5 text-muted-foreground max-w-[120px] truncate">
                              {row.sub_program_name || <span className="text-zinc-400">Club-wide</span>}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.date}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {row.start_time}{row.end_time ? ` – ${row.end_time}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importRows.some(r => !r.valid) && (
                    <p className="text-xs text-red-600 mt-1.5">Rows with errors will be skipped.</p>
                  )}
                </div>
              )}

              {/* Import button */}
              {importRows.some(r => r.valid) && club && (
                <div className="flex gap-2 pt-1">
                  <Button
                    disabled={importing}
                    onClick={async () => {
                      setImporting(true)
                      try {
                        const { data: { user } } = await supabase.auth.getUser()
                        const toInsert = importRows.filter(r => r.valid).map(r => ({
                          club_id: club.id,
                          season_id: currentSeason?.id ?? null,
                          sub_program_id: r.sub_program_id ?? null,
                          title: r.title,
                          event_type: r.event_type as Event['event_type'],
                          location: r.location || null,
                          start_at: new Date(`${r.date}T${r.start_time}`).toISOString(),
                          end_at: r.end_time ? new Date(`${r.date}T${r.end_time}`).toISOString() : null,
                          notes: r.notes || null,
                          created_by: user?.id ?? null,
                        }))
                        const { error } = await supabase.from('events').insert(toInsert)
                        if (error) throw error
                        toast.success(`Imported ${toInsert.length} event${toInsert.length !== 1 ? 's' : ''}`)
                        setImportOpen(false)
                        setImportRows([])
                      } catch {
                        toast.error('Import failed — check your assignments for those programs')
                      } finally {
                        setImporting(false)
                      }
                    }}
                    className="gap-2"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {importing ? 'Importing…' : `Import ${importRows.filter(r => r.valid).length} events`}
                  </Button>
                  <Button variant="outline" onClick={() => setImportRows([])}>Clear</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Convert a Date to the datetime-local input format (local time)
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
