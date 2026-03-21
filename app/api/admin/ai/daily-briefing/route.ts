import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

  const clubId = profile.club_id
  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const body = parsed.data
  const admin = createSupabaseAdminClient()

  // Verify AI is enabled
  const { data: club } = await admin
    .from('clubs')
    .select('name, ai_enabled, ai_training_context')
    .eq('id', clubId)
    .single()

  if (!club?.ai_enabled) {
    return NextResponse.json(
      { error: 'AI features are not enabled for your club. Enable them under Settings → AI & Intelligence.' },
      { status: 403 }
    )
  }

  // Fetch all events for that day
  const dayStart = `${body.date}T00:00:00.000Z`
  const dayEnd   = `${body.date}T23:59:59.999Z`

  const { data: events } = await admin
    .from('events')
    .select('title, event_type, start_at, end_at, location, notes, sub_programs(name, programs(name)), groups(name)')
    .eq('club_id', clubId)
    .gte('start_at', dayStart)
    .lte('start_at', dayEnd)
    .order('start_at', { ascending: true })

  if (!events?.length) {
    return NextResponse.json({ error: 'No events found for this date.' }, { status: 404 })
  }

  // Format events for the prompt
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

  const prompt = `You are an expert ski club administrator preparing a concise daily briefing for club leadership.

Club: ${club.name}
Date: ${dateLabel}
${club.ai_training_context ? `Club context: ${club.ai_training_context}` : ''}

Below are all training sessions and events scheduled for today:

---

${eventLines}

---

Generate a **Daily Training Briefing** with the following structure:

## Day Overview
2–3 sentences summarising the overall training day — how many sessions, what types, any notable themes.

## Program Summaries
For each program or sub-program active today, write a short paragraph (3–5 sentences) covering:
- What the athletes are working on (technical focus, phase of season, intensity)
- Any noteworthy drills, race prep, or themes
- Anything a club director or parent would find useful to know

## Highlights & Flags
Bullet points for anything worth flagging: races, high-intensity sessions, off-site locations, recovery days, or unusual circumstances.

## Athlete Readiness Note
One short paragraph on what the training day suggests about where the club is in the season cycle.

Keep the tone professional but readable — this is for club leadership, not coaches. Avoid repeating raw drill names verbatim; synthesise the intent.`

  const encoder = new TextEncoder()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
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
          user_id: profile.id,
          feature: 'daily_briefing',
          prompt_tokens: final.usage.input_tokens,
          completion_tokens: final.usage.output_tokens,
          model: 'claude-sonnet-4-6',
          metadata: { date: body.date, event_count: events.length },
        }).then(({ error }: { error: unknown }) => { if (error) console.error('ai_usage insert:', error) })
      } catch (err) {
        console.error('[daily-briefing] stream error:', err)
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
