import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { IMP_COOKIE, ImpersonationContext, redirectUrlForRole } from '@/lib/impersonation'

export const dynamic = 'force-dynamic'

// POST — start impersonating a user
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  if (authResult.profile.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const supabase = createAdminClient()

  // Fetch target user profile + club
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, club_id, clubs(name, slug)')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (profile.role === 'system_admin') {
    return NextResponse.json({ error: 'Cannot impersonate another system admin' }, { status: 400 })
  }

  const club = Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs as any
  const clubSlug = club?.slug ?? null
  const clubName = club?.name ?? null
  const userName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email

  // Log it
  const { data: log } = await supabase
    .from('impersonation_logs')
    .insert({
      admin_id: authResult.user.id,
      target_user_id: userId,
      target_user_email: profile.email,
      target_role: profile.role,
      club_slug: clubSlug,
    })
    .select('id')
    .single()

  const ctx: ImpersonationContext = {
    userId,
    userName,
    userEmail: profile.email,
    role: profile.role,
    clubSlug,
    clubName,
    logId: log?.id ?? '',
  }

  const redirectUrl = redirectUrlForRole(profile.role, clubSlug)

  const response = NextResponse.json({ success: true, redirectUrl, ctx })
  response.cookies.set(IMP_COOKIE, encodeURIComponent(JSON.stringify(ctx)), {
    path: '/',
    httpOnly: false, // readable by client for banner display
    sameSite: 'strict',
    maxAge: 60 * 60 * 4, // 4 hours
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}

// DELETE — exit impersonation
export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  // Close the log entry
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(/(?:^|;\s*)imp=([^;]*)/)
  if (match) {
    try {
      const ctx: ImpersonationContext = JSON.parse(decodeURIComponent(match[1]))
      if (ctx.logId) {
        const supabase = createAdminClient()
        await supabase
          .from('impersonation_logs')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', ctx.logId)
      }
    } catch {}
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(IMP_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
