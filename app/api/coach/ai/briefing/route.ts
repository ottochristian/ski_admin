import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { requireCoach } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const authResult = await requireCoach(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, profile } = authResult

  const clubId = profile.club_id

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsedBody = postSchema.safeParse(raw)
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0].message }, { status: 400 })
  }

  const body = parsedBody.data

  const admin = createSupabaseAdminClient()

  // Verify AI is enabled for the club
  const { data: club } = await admin
    .from('clubs')
    .select('name, ai_enabled, ai_training_context')
    .eq('id', clubId)
    .single()

  if (!club?.ai_enabled) {
    return NextResponse.json(
      { error: 'AI features are not enabled for your club.' },
      { status: 403 }
    )
  }

  // Get the coach's id from coaches table
  const { data: coachRow } = await admin
    .from('coaches')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  // Get the coach's assignments
  let programIds: string[] = []
  let subProgramIds: string[] = []
  let groupIds: string[] = []

  if (coachRow?.id) {
    const { data: assignments } = await admin
      .from('coach_assignments')
      .select('program_id, sub_program_id, group_id')
      .eq('coach_id', coachRow.id)

    if (assignments?.length) {
      programIds = assignments.map((a: any) => a.program_id).filter(Boolean)
      subProgramIds = assignments.map((a: any) => a.sub_program_id).filter(Boolean)
      groupIds = assignments.map((a: any) => a.group_id).filter(Boolean)
    }
  }

  // Fetch today's events for the club filtered to coach's scope
  const dayStart = `${body.date}T00:00:00.000Z`
  const dayEnd   = `${body.date}T23:59:59.999Z`

  const hasAssignments = programIds.length > 0 || subProgramIds.length > 0 || groupIds.length > 0

  let eventsQuery = admin
    .from('events')
    .select('title, event_type, start_at, end_at, location, notes, sub_programs(name, programs(name)), groups(name), program_id, sub_program_id, group_id')
    .eq('club_id', clubId)
    .gte('start_at', dayStart)
    .lte('start_at', dayEnd)
    .order('start_at', { ascending: true })

  const { data: allEvents } = await eventsQuery

  // Filter to assigned scope, or fallback to all club events if no assignments
  const events = !allEvents?.length
    ? []
    : !hasAssignments
    ? allEvents
    : allEvents.filter((ev: any) => {
        if (ev.program_id && programIds.includes(ev.program_id)) return true
        if (ev.sub_program_id && subProgramIds.includes(ev.sub_program_id)) return true
        if (ev.group_id && groupIds.includes(ev.group_id)) return true
        return false
      })

  if (!events.length) {
    return NextResponse.json({ error: 'No sessions scheduled' }, { status: 404 })
  }

  // Format events for prompt
  const dateLabel = new Date(body.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const eventLines = events.map((ev: any) => {
    const program = ev.sub_programs?.programs?.name ?? ''
    const subProgram = ev.sub_programs?.name ?? ''
    const group = ev.groups?.name ?? ''
    const scope = [program, subProgram, group].filter(Boolean).join(' › ')
    const startTime = new Date(ev.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const endTime = ev.end_at
      ? new Date(ev.end_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : null
    const timeStr = endTime ? `${startTime}–${endTime}` : startTime

    const lines = [
      `### ${ev.title} (${ev.event_type.toUpperCase()})`,
      `- Scope: ${scope || 'Club-wide'}`,
      `- Time: ${timeStr}`,
      ev.location ? `- Location: ${ev.location}` : null,
      ev.notes ? `- Session detail:\n${ev.notes}` : null,
    ]
    return lines.filter(Boolean).join('\n')
  }).join('\n\n')

  const assignmentScope = hasAssignments
    ? [
        ...programIds.map(() => 'program'),
        ...subProgramIds.map(() => 'sub-program'),
        ...groupIds.map(() => 'group'),
      ].length + ' scope(s)'
    : 'All club programs (no specific assignments)'

  const prompt = `You are an expert ski coach assistant preparing a concise training briefing for a coach.

Club: ${club.name}
Date: ${dateLabel}
Your assigned programs: ${assignmentScope}
${club.ai_training_context ? `Club context: ${club.ai_training_context}` : ''}

Below are today's sessions relevant to your assignments:

---

${eventLines}

---

Generate a **Coach's Training Briefing** with:

## Today's Sessions
1-2 sentences overview of what's on the schedule today.

## Coaching Focus
For each session, 2-3 sentences on the technical focus, athlete readiness signals to watch for, and any coaching cues worth emphasising.

## Athlete Notes
Any patterns or flags worth noting — intensity load, session sequencing, recovery considerations.

Keep it practical and coach-facing. Concise.`

  const encoder = new TextEncoder()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        // Log usage
        const final = await stream.finalMessage()
        admin.from('ai_usage').insert({
          club_id: clubId,
          user_id: user.id,
          feature: 'coach_briefing',
          prompt_tokens: final.usage.input_tokens,
          completion_tokens: final.usage.output_tokens,
          model: 'claude-sonnet-4-6',
          metadata: { date: body.date, event_count: events.length },
        }).then(({ error }: { error: unknown }) => { if (error) console.error('ai_usage insert:', error) })
      } catch (err) {
        console.error('[coach-briefing] stream error:', err)
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
