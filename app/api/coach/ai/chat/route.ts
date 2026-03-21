import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

import { z } from 'zod'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const postSchema = z.object({
  messages: z.array(messageSchema).min(1, 'messages array must not be empty'),
  season_id: z.string().uuid().optional(),
})

type MessageParam = z.infer<typeof messageSchema>

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const admin = createSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, club_id, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: club } = await admin
    .from('clubs')
    .select('id, name, ai_enabled')
    .eq('id', profile.club_id)
    .single()

  if (!club?.ai_enabled) {
    return NextResponse.json({ error: 'AI features are not enabled for your club.' }, { status: 403 })
  }

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

  // Resolve coach's assigned sub_program_ids and group_ids
  const { data: coachRow } = await admin
    .from('coaches')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  const { data: assignments } = coachRow
    ? await admin
        .from('coach_assignments')
        .select('program_id, sub_program_id, group_id')
        .eq('coach_id', coachRow.id)
    : { data: [] }

  const assignedGroupIds: string[] = []
  const assignedSpIds = new Set<string>()

  for (const a of assignments ?? []) {
    if (a.group_id) assignedGroupIds.push(a.group_id)
    if (a.sub_program_id) assignedSpIds.add(a.sub_program_id)
    if (a.program_id && !a.sub_program_id && !a.group_id) {
      const { data: sps } = await admin.from('sub_programs').select('id').eq('program_id', a.program_id)
      sps?.forEach((sp: { id: string }) => assignedSpIds.add(sp.id))
    }
  }

  const spIds = [...assignedSpIds]
  const groupIds = assignedGroupIds

  // Resolve active season
  let seasonId: string | null = body.season_id ?? null
  if (!seasonId) {
    const { data: season } = await admin
      .from('seasons')
      .select('id')
      .eq('club_id', club.id)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .single()
    seasonId = season?.id ?? null
  }

  const coachName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Coach'

  const tools: Anthropic.Tool[] = [
    {
      name: 'get_my_athletes',
      description: 'Get athletes enrolled in your assigned programs. Can filter by sub-program name.',
      input_schema: {
        type: 'object' as const,
        properties: {
          sub_program_name: { type: 'string', description: 'Optional: filter by sub-program name (partial match)' },
        },
      },
    },
    {
      name: 'get_waiver_status',
      description: 'Get waiver completion for athletes in your programs — who has signed and who hasn\'t.',
      input_schema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'get_upcoming_events',
      description: 'Get upcoming events for your assigned groups.',
      input_schema: {
        type: 'object' as const,
        properties: {
          days: { type: 'number', description: 'How many days forward to look (default 14)' },
        },
      },
    },
    {
      name: 'get_payment_status',
      description: 'Get payment status for athletes in your programs — who has outstanding payments.',
      input_schema: { type: 'object' as const, properties: {} },
    },
  ]

  async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    const now = new Date()

    if (name === 'get_my_athletes') {
      if (spIds.length === 0) return JSON.stringify({ total: 0, athletes: [] })
      const { data } = await admin
        .from('registrations')
        .select('id, athletes(first_name, last_name), sub_programs(name, programs(name)), payment_status')
        .in('sub_program_id', spIds)
        .eq('club_id', club.id)
        .neq('status', 'cancelled')

      let regs: any[] = data ?? []
      if (input.sub_program_name) {
        const search = (input.sub_program_name as string).toLowerCase()
        regs = regs.filter((r: any) =>
          ((r.sub_programs as any)?.name ?? '').toLowerCase().includes(search)
        )
      }

      return JSON.stringify({
        total: regs.length,
        athletes: regs.slice(0, 30).map((r: any) => ({
          name: `${r.athletes?.first_name ?? ''} ${r.athletes?.last_name ?? ''}`.trim(),
          sub_program: r.sub_programs?.name,
          payment_status: r.payment_status,
        })),
      })
    }

    if (name === 'get_waiver_status') {
      if (!seasonId || spIds.length === 0) return JSON.stringify({ error: 'No active season or assigned programs' })

      const { data: waivers } = await admin
        .from('waivers')
        .select('id, title')
        .eq('club_id', club.id)
        .eq('season_id', seasonId)
        .eq('required', true)

      const waiverIds = (waivers ?? []).map((w: { id: string }) => w.id)
      const { data: sigs } = waiverIds.length > 0
        ? await admin.from('waiver_signatures').select('athlete_id, waiver_id').in('waiver_id', waiverIds)
        : { data: [] }

      const { data: regs } = await admin
        .from('registrations')
        .select('athletes(id, first_name, last_name)')
        .in('sub_program_id', spIds)
        .eq('club_id', club.id)
        .neq('status', 'cancelled')

      const signedIds = new Set((sigs ?? []).map((s: { athlete_id: string }) => s.athlete_id))
      const allAthletes = (regs ?? []).map((r: any) => {
        const a = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
        return { id: a?.id, name: `${a?.first_name ?? ''} ${a?.last_name ?? ''}`.trim() }
      }).filter((a: { id?: string }) => a.id)

      const unsigned = allAthletes.filter((a: { id: string }) => !signedIds.has(a.id))

      return JSON.stringify({
        required_waivers: (waivers ?? []).map((w: { title: string }) => w.title),
        total_athletes: allAthletes.length,
        signed: signedIds.size,
        unsigned_count: unsigned.length,
        unsigned_athletes: unsigned.slice(0, 20).map((a: { name: string }) => a.name),
      })
    }

    if (name === 'get_upcoming_events') {
      const days = typeof input.days === 'number' ? input.days : 14
      if (groupIds.length === 0) return JSON.stringify({ total: 0, events: [] })

      const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await admin
        .from('events')
        .select('title, event_type, start_at, end_at')
        .in('group_id', groupIds)
        .gte('start_at', now.toISOString())
        .lte('start_at', until)
        .order('start_at', { ascending: true })

      return JSON.stringify({
        days_forward: days,
        total: (data ?? []).length,
        events: (data ?? []).map((ev: any) => ({
          title: ev.title,
          type: ev.event_type,
          formatted: new Date(ev.start_at).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          }),
        })),
      })
    }

    if (name === 'get_payment_status') {
      if (spIds.length === 0) return JSON.stringify({ unpaid: 0 })
      const { data } = await admin
        .from('registrations')
        .select('id, payment_status, athletes(first_name, last_name)')
        .in('sub_program_id', spIds)
        .eq('club_id', club.id)
        .neq('status', 'cancelled')
        .neq('payment_status', 'paid')

      return JSON.stringify({
        unpaid_count: (data ?? []).length,
        athletes: (data ?? []).slice(0, 20).map((r: any) => ({
          name: `${r.athletes?.first_name ?? ''} ${r.athletes?.last_name ?? ''}`.trim(),
          payment_status: r.payment_status,
        })),
      })
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` })
  }

  const systemPrompt = `You are an AI assistant for ${coachName}, a ski coach at ${club.name}.
You have access to tools that query data scoped to ${coachName}'s assigned programs and groups only.
Give concise, factual answers. Always use the tools to look up data — never make up numbers or names.
Keep responses professional and coach-friendly.`

  const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  let iteration = 0
  let finalText = ''

  while (iteration < 5) {
    iteration++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      tools,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      for (const block of response.content) {
        if (block.type === 'text') finalText += block.text
      }
      break
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input as Record<string, unknown>)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
        }
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    for (const block of response.content) {
      if (block.type === 'text') finalText += block.text
    }
    break
  }

  return NextResponse.json({ message: finalText || 'Unable to generate a response. Please try again.' })
}
