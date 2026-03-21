import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/api-auth'
import { log } from '@/lib/logger'

const postSchema = z.object({
  clubId: z.string().uuid(),
})

// POST /api/admin/stripe/connect/disconnect
// Body: { clubId: string }
// Auth: requireAdmin (system_admin or club admin)
// Clears Stripe Connect fields from DB (does not delete Stripe account)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { profile } = authResult

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

    const { clubId } = parsedBody.data

    // Verify access
    if (profile.role !== 'system_admin' && profile.club_id !== clubId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createSupabaseAdminClient()

    const { error: updateError } = await supabase
      .from('clubs')
      .update({
        stripe_account_id: null,
        stripe_connect_status: 'not_connected',
        stripe_onboarding_completed_at: null,
      })
      .eq('id', clubId)

    if (updateError) {
      log.error('Failed to disconnect Stripe account', updateError, { clubId })
      return NextResponse.json({ error: 'Failed to disconnect Stripe account' }, { status: 500 })
    }

    log.info('Stripe Connect disconnected', { clubId })

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error('Stripe Connect disconnect error', error)
    return NextResponse.json({ error: 'Failed to disconnect Stripe account' }, { status: 500 })
  }
}
