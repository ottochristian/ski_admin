import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const postSchema = z.object({
  target_type: z.enum(['program', 'sub_program', 'group']).optional(),
  target_id: z.string().uuid().optional(),
  household_id: z.string().uuid().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  club_name: z.string().optional(),
  program_name: z.string().optional(),
}).refine(
  (d) => d.household_id || (d.target_type && d.target_id),
  { message: 'Provide either household_id or target_type + target_id' }
)

// Resolves merge fields for the first recipient of a target — used for live preview
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['coach', 'admin', 'system_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

  const { target_type, target_id, household_id: directHouseholdId, subject, body: bodyTemplate, club_name, program_name } = parsedBody.data

  const admin = createSupabaseAdminClient()

  // Resolve one sample household
  let householdId: string | null = directHouseholdId ?? null

  if (!householdId) {
    if (target_type === 'group') {
      const { data } = await admin
        .from('registrations')
        .select('athletes(household_id)')
        .eq('group_id', target_id)
        .limit(1)
      householdId = extractFirstHouseholdId(data)
    } else if (target_type === 'sub_program') {
      const { data } = await admin
        .from('registrations')
        .select('athletes(household_id)')
        .eq('sub_program_id', target_id)
        .limit(1)
      householdId = extractFirstHouseholdId(data)
    } else {
      const { data: sps } = await admin
        .from('sub_programs')
        .select('id')
        .eq('program_id', target_id)
        .limit(1)
      if (sps && sps.length > 0) {
        const { data } = await admin
          .from('registrations')
          .select('athletes(household_id)')
          .eq('sub_program_id', sps[0].id)
          .limit(1)
        householdId = extractFirstHouseholdId(data)
      }
    }
  }

  if (!householdId) {
    // No recipients — return template unchanged as preview
    return NextResponse.json({
      subject: subject ?? '',
      body: bodyTemplate ?? '',
      sample_name: null,
    })
  }

  // Fetch parent first name + athlete first name for this household
  const [{ data: guardians }, { data: athletes }] = await Promise.all([
    admin
      .from('household_guardians')
      .select('profiles(first_name)')
      .eq('household_id', householdId)
      .limit(1),
    admin
      .from('athletes')
      .select('first_name')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  const guardianProfile = guardians?.[0]
    ? Array.isArray(guardians[0].profiles)
      ? guardians[0].profiles[0]
      : guardians[0].profiles
    : null
  const parentFirstName = (guardianProfile as any)?.first_name ?? 'there'
  const athleteFirstName = athletes?.[0]?.first_name ?? 'your athlete'

  const tokens: Record<string, string> = {
    '{{parent_first_name}}': parentFirstName,
    '{{athlete_first_name}}': athleteFirstName,
    '{{club_name}}': club_name ?? '',
    '{{program_name}}': program_name ?? '',
  }

  function resolve(template: string): string {
    return template.replace(/\{\{[^}]+\}\}/g, (match) => tokens[match] ?? match)
  }

  return NextResponse.json({
    subject: resolve(subject ?? ''),
    body: resolve(bodyTemplate ?? ''),
    sample_name: parentFirstName,
  })
}

function extractFirstHouseholdId(regs: any[] | null): string | null {
  if (!regs || regs.length === 0) return null
  const athlete = Array.isArray(regs[0].athletes) ? regs[0].athletes[0] : regs[0].athletes
  return athlete?.household_id ?? null
}
