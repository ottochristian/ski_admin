import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { notificationService } from '@/lib/services/notification-service'

const postSchema = z.object({
  slug: z.string().min(1).trim(),
  clubName: z.string().min(1).trim(),
})

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  if (authResult.profile.role !== 'system_admin') {
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

  const { slug, clubName } = parsedBody.data

  const supabase = createAdminClient()

  // Fetch the request
  const { data: clubRequest, error: fetchError } = await supabase
    .from('club_requests')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (fetchError || !clubRequest) {
    return NextResponse.json({ error: 'Request not found or already processed' }, { status: 404 })
  }

  // Check slug isn't taken
  const { data: existing } = await supabase
    .from('clubs')
    .select('id')
    .eq('slug', slug.trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: `Slug "${slug}" is already taken` }, { status: 409 })
  }

  // Create the club
  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .insert({
      name: clubName.trim(),
      slug: slug.trim(),
    })
    .select('id, slug')
    .single()

  if (clubError || !club) {
    console.error('[approve] club create error:', clubError)
    return NextResponse.json({ error: 'Failed to create club' }, { status: 500 })
  }

  // Update the user's profile to admin + link to club
  if (clubRequest.user_id) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'admin', club_id: club.id })
      .eq('id', clubRequest.user_id)

    if (profileError) {
      console.error('[approve] profile update error:', profileError)
      // Don't fail — club was created, log and continue
    }
  }

  // Mark request approved
  await supabase
    .from('club_requests')
    .update({ status: 'approved', provisioned_club_id: club.id, updated_at: new Date().toISOString() })
    .eq('id', id)

  // Send "club is ready" email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.w110.io'
  const clubUrl = `${appUrl}/clubs/${club.slug}/admin`

  notificationService.sendClubReady(clubRequest.contact_email, {
    firstName: clubRequest.contact_name.split(' ')[0],
    clubName: clubName.trim(),
    clubUrl,
  }).catch(err => console.error('[approve] ready email error:', err))

  return NextResponse.json({ success: true, clubSlug: club.slug, clubId: club.id })
}
