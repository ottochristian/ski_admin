import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { searchParams } = new URL(request.url)
  const clubSlug = searchParams.get('clubSlug')
  const seasonId = searchParams.get('seasonId')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const offset = (page - 1) * limit

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['coach', 'admin', 'system_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createSupabaseAdminClient()

  // Resolve club
  let clubId: string | null = null
  if (clubSlug) {
    const { data: club } = await admin.from('clubs').select('id').eq('slug', clubSlug).single()
    clubId = club?.id ?? null
  }

  if (!clubId) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  // Admins see all club messages; coaches see only their own
  let query = supabase
    .from('messages')
    .select(`
      id, subject, body, sent_at, email_sent_at, program_id, sub_program_id, group_id,
      sender:profiles!messages_sender_id_fkey(id, first_name, last_name, email)
    `)
    .eq('club_id', clubId)
    .order('sent_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (profile.role === 'coach') {
    query = query.eq('sender_id', user.id)
  }

  if (seasonId) {
    query = query.eq('season_id', seasonId)
  }

  const { data: messages, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to load sent messages' }, { status: 500 })
  }

  // Attach recipient counts
  if (messages && messages.length > 0) {
    const ids = messages.map((m) => m.id)
    const { data: counts } = await admin
      .from('message_recipients')
      .select('message_id')
      .in('message_id', ids)

    const countMap: Record<string, number> = {}
    for (const row of counts ?? []) {
      countMap[row.message_id] = (countMap[row.message_id] ?? 0) + 1
    }

    const result = messages.map((m) => ({
      ...m,
      recipient_count: countMap[m.id] ?? 0,
    }))

    return NextResponse.json({ messages: result, total: count ?? result.length })
  }

  return NextResponse.json({ messages: [], total: 0 })
}
