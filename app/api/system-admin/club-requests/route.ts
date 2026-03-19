import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult
  if (authResult.profile.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'

  const { data, error } = await supabase
    .from('club_requests')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[system-admin/club-requests] fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }

  return NextResponse.json({ requests: data })
}
