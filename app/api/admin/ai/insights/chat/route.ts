import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdmin } from '@/lib/api-auth'
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

// ─── Security validator ────────────────────────────────────────────────────────
// Defence-in-depth before the query reaches Postgres.
// Primary isolation is the CTE wrapper in execute_club_scoped_query().
function validateSql(sql: string): string | null {
  const s = sql.trim()

  // Must be a SELECT or a CTE (WITH ... SELECT)
  if (!/^(WITH\s|SELECT\s)/i.test(s)) {
    return 'Only SELECT statements are allowed'
  }

  // No semicolons — prevents statement chaining
  if (s.includes(';')) {
    return 'Semicolons are not allowed'
  }

  // Block mutation / DDL keywords
  if (/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|COPY|EXECUTE|DO)\b/i.test(s)) {
    return 'Data modification statements are not allowed'
  }

  // Block schema-qualified refs — would bypass the CTE shadows
  if (/\b(public|pg_catalog|information_schema|auth|storage|vault|extensions)\s*\./i.test(s)) {
    return 'Schema-qualified table references are not allowed'
  }

  // Block dangerous Postgres functions
  if (/\b(pg_read_file|pg_ls_dir|pg_stat_file|pg_sleep|set_config|pg_reload_conf|dblink|lo_export|lo_import|pg_cancel_backend|pg_terminate_backend)\b/i.test(s)) {
    return 'Unsafe function references are not allowed'
  }

  return null
}

// ─── Schema context for Claude ────────────────────────────────────────────────
// Only expose columns that exist in the CTE-scoped views.
// club_id is intentionally omitted — it's handled automatically.
const SCHEMA_CONTEXT = `
Available tables and their columns (all automatically scoped to this club):

athletes(id, first_name, last_name, date_of_birth, gender, ussa_number, fis_license, household_id, created_at)
registrations(id, athlete_id, sub_program_id, season_id, status, payment_status, registration_date, created_at)
  -- status: 'active'|'pending'|'cancelled'  payment_status: 'paid'|'pending'|'unpaid'
seasons(id, name, start_date, end_date, status, is_current)
  -- status: 'active'|'draft'|'archived'
programs(id, name, season_id, status, is_active)
sub_programs(id, name, program_id, season_id, registration_fee, max_capacity, status, is_active)
households(id, primary_email, phone, city, state, created_at)
household_guardians(id, household_id, user_id, is_primary)
profiles(id, email, first_name, last_name, phone, role)
  -- role: 'family'|'coach'|'admin'
orders(id, household_id, season_id, total_amount, status, created_at)
  -- status: 'unpaid'|'paid'|'refunded'  total_amount is in dollars (not cents)
payments(id, order_id, amount, status, method, processed_at)
  -- status: 'pending'|'succeeded'|'failed'  amount is in dollars
order_items(id, order_id, registration_id, description, amount)
waivers(id, title, required, season_id, status)
waiver_signatures(id, waiver_id, athlete_id, guardian_id, signed_at)
events(id, title, event_type, start_at, end_at, location, season_id, program_id)
messages(id, subject, sender_id, season_id, sent_at, direct_email_count)
message_recipients(id, message_id, recipient_id, read_at)
coaches(id, first_name, last_name, email, phone, is_active)
groups(id, name, sub_program_id, age_min, age_max)
`.trim()

// ─── Tool definition ──────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'execute_sql',
    description: `Execute a read-only PostgreSQL SELECT query against this club's database.
All tables are automatically scoped to this club — do NOT add club_id filters.
Results are capped at 500 rows. Use the explanation field to describe what you're fetching.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description: 'A PostgreSQL SELECT query. No club_id filters needed — scoping is automatic. No schema-qualified table names (e.g. use "athletes" not "public.athletes").',
        },
        explanation: {
          type: 'string',
          description: 'One sentence describing what this query fetches',
        },
      },
      required: ['sql'],
    },
  },
]

// ─── Route handler ─────────────────────────────────────────────────────────────
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

  // Verify AI is enabled for this club
  const { data: club } = await admin
    .from('clubs')
    .select('name, ai_enabled, ai_insights_enabled')
    .eq('id', clubId)
    .single()

  if (!club?.ai_enabled || !club?.ai_insights_enabled) {
    return NextResponse.json({ error: 'Club Intelligence is not enabled.' }, { status: 403 })
  }

  // Resolve active season
  let seasonId: string | null = body.season_id ?? null
  if (!seasonId) {
    const { data: season } = await admin
      .from('seasons')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .single()
    seasonId = season?.id ?? null
  }

  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `You are a club intelligence assistant for ${club.name}, a ski club.
Today's date: ${today}
Active season ID: ${seasonId ?? 'none — no active season found'}

You have one tool: execute_sql. Use it to answer any question about the club's data.
Write standard PostgreSQL SELECT queries. You may use JOINs, CTEs, aggregates, window functions — anything read-only.

IMPORTANT rules:
- Never filter by club_id — all tables are already scoped to this club automatically
- Use the active season_id (${seasonId ?? 'N/A'}) when filtering to the current season
- Never make up or assume data — always query first
- If a query returns no rows, say so clearly
- Keep answers concise and factual, suited for a club administrator
- Format numbers nicely (e.g. "$1,234.00" for money, "42 athletes")
- When listing people, include names; when showing counts, be specific

${SCHEMA_CONTEXT}`

  const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  let iteration = 0
  const maxIterations = 10
  let finalText = ''

  while (iteration < maxIterations) {
    iteration++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
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
        if (block.type !== 'tool_use') continue

        if (block.name === 'execute_sql') {
          const input = block.input as { sql?: string; explanation?: string }
          const sql = input.sql?.trim() ?? ''

          // TypeScript-level validation
          const validationError = validateSql(sql)
          if (validationError) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: validationError }),
              is_error: true,
            })
            continue
          }

          // Execute via the secure Postgres function (CTE-wrapped, club-scoped, read-only)
          const { data, error } = await admin.rpc('execute_club_scoped_query', {
            p_club_id: clubId,
            p_sql: sql,
          })

          if (error) {
            console.error('[insights/chat] query error:', error.message, '\nSQL:', sql)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: error.message }),
              is_error: true,
            })
          } else {
            const rows = Array.isArray(data) ? data : (data ?? [])
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ rows, row_count: rows.length }),
            })
          }
        }
      }

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Unexpected stop reason
    for (const block of response.content) {
      if (block.type === 'text') finalText += block.text
    }
    break
  }

  if (!finalText) {
    finalText = 'I was unable to generate a response. Please try again.'
  }

  // Log usage (best-effort)
  admin
    .from('ai_usage')
    .insert({
      club_id: clubId,
      user_id: profile.id,
      feature: 'club_insights_chat',
      prompt_tokens: 0,
      completion_tokens: 0,
      model: 'claude-sonnet-4-6',
      metadata: { season_id: seasonId, iterations: iteration },
    })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error('[insights/chat] ai_usage insert:', error)
    })

  return NextResponse.json({ message: finalText })
}
