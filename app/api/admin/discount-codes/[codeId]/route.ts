import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateCodeSchema = z.object({
  description: z.string().max(255).optional().nullable(),
  type: z.enum(['percent', 'fixed']).optional(),
  value: z.number().positive().optional(),
  min_order_cents: z.number().int().min(0).optional(),
  max_uses: z.number().int().positive().optional().nullable(),
  max_uses_per_household: z.number().int().positive().optional().nullable(),
  max_uses_per_athlete: z.number().int().positive().optional().nullable(),
  valid_from: z.string().datetime().optional().nullable(),
  valid_to: z.string().datetime().optional().nullable(),
  season_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

async function getCodeAndVerifyOwnership(
  codeId: string,
  clubId: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  const { data, error } = await supabase
    .from('discount_codes')
    .select('id, club_id')
    .eq('id', codeId)
    .single()

  if (error || !data) return null
  if (data.club_id !== clubId) return null
  return data
}

// PATCH — update a discount code
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const clubId = authResult.profile.club_id
  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 400 })
  }

  const { codeId } = await params
  const supabase = createAdminClient()
  const existing = await getCodeAndVerifyOwnership(codeId, clubId, supabase)
  if (!existing) {
    return NextResponse.json({ error: 'Discount code not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateCodeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('discount_codes')
    .update(parsed.data)
    .eq('id', codeId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ code: data })
}

// DELETE — soft delete (deactivate)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  const clubId = authResult.profile.club_id
  if (!clubId) {
    return NextResponse.json({ error: 'No club associated with your account' }, { status: 400 })
  }

  const { codeId } = await params
  const supabase = createAdminClient()
  const existing = await getCodeAndVerifyOwnership(codeId, clubId, supabase)
  if (!existing) {
    return NextResponse.json({ error: 'Discount code not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('discount_codes')
    .update({ is_active: false })
    .eq('id', codeId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
