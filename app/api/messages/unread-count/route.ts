import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { count, error } = await supabase
    .from('message_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 })
  }

  return NextResponse.json({ unread_count: count ?? 0 })
}
