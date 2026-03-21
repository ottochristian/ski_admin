import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { notificationService } from '@/lib/services/notification-service'

const postSchema = z.object({
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  phone: z.string().optional().nullable(),
  clubName: z.string().min(1, 'Club name is required').trim(),
  athleteCountEstimate: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

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

  const { firstName, lastName, phone, clubName, athleteCountEstimate, notes } = parsedBody.data

  const admin = createSupabaseAdminClient()

  // Save profile info
  await admin.from('profiles').update({
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    phone: phone || null,
  }).eq('id', user.id)

  const slugRequested = clubName.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const contactName = `${firstName.trim()} ${lastName.trim()}`

  const { data: clubRequest, error } = await admin.from('club_requests').insert({
    contact_name: contactName,
    contact_email: user.email,
    club_name: clubName.trim(),
    slug_requested: slugRequested,
    athlete_count_estimate: athleteCountEstimate || null,
    notes: notes || null,
    user_id: user.id,
  }).select('id').single()

  if (error) {
    console.error('[club-requests] insert error:', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.w110.io'
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL

  await Promise.allSettled([
    notificationService.sendClubRequestReceived(user.email!, {
      firstName: firstName.trim(),
      clubName: clubName.trim(),
    }),
    adminEmail
      ? notificationService.sendClubRequestNotification(adminEmail, {
          contactName,
          contactEmail: user.email!,
          clubName: clubName.trim(),
          athleteCount: athleteCountEstimate?.toString(),
          notes,
          reviewUrl: `${appUrl}/system-admin/club-requests`,
        })
      : Promise.resolve(),
  ])

  return NextResponse.json({ success: true, requestId: clubRequest.id })
}
