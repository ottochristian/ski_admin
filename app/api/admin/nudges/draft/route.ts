import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  const { profile } = authResult

  const clubId = profile.club_id
  if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 403 })

  const body = await request.json()
  const { type, title, detail, target_name, recipient_count, preview_names } = body

  const admin = createSupabaseAdminClient()
  const [{ data: club }, { data: fullProfile }] = await Promise.all([
    admin.from('clubs').select('name').eq('id', clubId).single(),
    admin.from('profiles').select('first_name, last_name').eq('id', profile.id).single(),
  ])
  const clubName = club?.name ?? 'the club'
  const senderName =
    [fullProfile?.first_name, fullProfile?.last_name].filter(Boolean).join(' ') || 'The Admin Team'

  const systemPrompt = `You are a communication assistant for ${clubName}, a ski club. Write a short, warm, professional email from the admin team to individual families.

Output format — two parts separated by a blank line:
1. The email subject (one line, no label)
2. The email body (plain text, 3-5 sentences)

Personalise every email using these merge fields exactly as written:
- {{parent_first_name}} — always open with "Hi {{parent_first_name}},"
- {{athlete_first_name}} — the athlete's first name
- {{club_name}} — the club name
- {{program_name}} — the program or group name

No JSON, no markdown, no extra labels. Just subject, blank line, body.`

  const userPrompt = `Write an email for this situation:
Type: ${type}
Situation: ${title}
Detail: ${detail}
Target group: ${target_name}
Number of affected families: ${recipient_count}
Sender: ${senderName} at ${clubName}

For payment reminders: be polite but firm, mention {{athlete_first_name}}'s spot may be at risk.
For waiver reminders: explain why the waiver matters for {{athlete_first_name}}'s participation.
Always address {{parent_first_name}} personally.`

  // Log usage fire-and-forget (estimate tokens, exact count not available for streams easily)
  admin.from('ai_usage').insert({
    club_id: clubId,
    user_id: profile.id,
    feature: 'nudge_draft',
    model: 'claude-sonnet-4-6',
  }).then(({ error }: { error: unknown }) => {
    if (error) console.error('[nudge draft] usage log:', error)
  })

  // Stream the response
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
        console.error('[nudge draft] stream error:', err)
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
