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
  const { prompt, target_name, recipient_count, program_name, season_name } = body

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const [{ data: club }, { data: fullProfile }] = await Promise.all([
    admin.from('clubs').select('name').eq('id', clubId).single(),
    admin.from('profiles').select('first_name, last_name').eq('id', profile.id).single(),
  ])
  const clubName = club?.name ?? 'the club'
  const senderName =
    [fullProfile?.first_name, fullProfile?.last_name].filter(Boolean).join(' ') || 'The Admin Team'

  const mergeFieldDocs = `
Available merge fields (use exactly as written — double curly braces, no spaces inside):
- {{parent_first_name}} — the parent/guardian's first name (e.g. "Hi {{parent_first_name}},")
- {{athlete_first_name}} — the athlete's first name
- {{club_name}} — the club name
- {{program_name}} — the program or group name
Use merge fields naturally to personalise the message where it adds warmth. Always open with "Hi {{parent_first_name}}," unless the message is formal.`

  const systemPrompt = `You are a communication assistant for ${clubName}, a ski club. Write concise, warm, professional emails from the admin team to families.
Always return a JSON object with exactly two fields: "subject" (string, concise) and "body" (string, plain text, 3-6 sentences).
No markdown, no signatures, no extra formatting. Write in the voice of ${senderName} at ${clubName}.
${mergeFieldDocs}`

  const contextParts = [
    target_name && `Audience: ${target_name}`,
    recipient_count && `Number of families: ${recipient_count}`,
    program_name && `Program: ${program_name}`,
    season_name && `Season: ${season_name}`,
  ].filter(Boolean)

  const userPrompt = `Write an email for this situation:
${prompt}
${contextParts.length > 0 ? `\nContext:\n${contextParts.join('\n')}` : ''}

Remember to start with "Hi {{parent_first_name}}," and use other merge fields where natural.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    // Log usage
    admin
      .from('ai_usage')
      .insert({
        club_id: clubId,
        user_id: profile.id,
        feature: 'message_draft',
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        model: 'claude-sonnet-4-6',
      })
      .then(({ error }: { error: unknown }) => {
        if (error) console.error('[message draft] usage log:', error)
      })

    return NextResponse.json({ subject: parsed.subject, body: parsed.body })
  } catch (err) {
    console.error('[message draft] error:', err)
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 })
  }
}
