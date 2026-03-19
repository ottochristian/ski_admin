import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  const admin = createSupabaseAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, club_id, role, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'coach' || !profile.club_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: club } = await admin.from('clubs').select('name').eq('id', profile.club_id).single()
  const clubName = club?.name ?? 'the club'
  const senderName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your Coach'

  const body = await request.json()
  const { type, title, detail, target_name, recipient_count } = body

  const systemPrompt = `You are a communication assistant helping a ski coach at ${clubName} write emails to individual athlete families.

Output format — two parts separated by a blank line:
1. The email subject (one line, no label)
2. The email body (plain text, 3-5 sentences, warm and friendly)

Personalise every email using these merge fields exactly as written:
- {{parent_first_name}} — always open with "Hi {{parent_first_name}},"
- {{athlete_first_name}} — the athlete's first name
- {{club_name}} — the club name
- {{program_name}} — the group or program name

No JSON, no markdown, no extra labels. Just subject, blank line, body.`

  const userPrompt = `Write an email for this situation:
Type: ${type}
Situation: ${title}
Detail: ${detail}
Group: ${target_name}
Families: ${recipient_count ?? 'some'}
Coach: ${senderName} at ${clubName}

For waiver reminders: explain why signing matters for {{athlete_first_name}}'s safety and participation.
For payment reminders: be warm but clear.
For event reminders: build excitement.
Always address {{parent_first_name}} personally.`

  admin.from('ai_usage').insert({
    club_id: profile.club_id,
    user_id: profile.id,
    feature: 'coach_nudge_draft',
    model: 'claude-sonnet-4-6',
  }).then(({ error }: { error: unknown }) => {
    if (error) console.error('[coach nudge draft] usage:', error)
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        console.error('[coach nudge draft] stream error:', err)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
