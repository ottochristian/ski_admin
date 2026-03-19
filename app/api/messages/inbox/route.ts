import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const offset = (page - 1) * limit

  // Fetch recipient rows for this user
  let recipientQuery = supabase
    .from('message_recipients')
    .select('message_id, read_at, created_at')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })

  if (unreadOnly) {
    recipientQuery = recipientQuery.is('read_at', null)
  }

  const { data: recipientRows, error: recipientError } = await recipientQuery

  if (recipientError) {
    return NextResponse.json({ error: 'Failed to load inbox' }, { status: 500 })
  }

  if (!recipientRows || recipientRows.length === 0) {
    return NextResponse.json({ messages: [], unread_count: 0, total: 0 })
  }

  // Unread count (across all, not just this page)
  const unreadCount = recipientRows.filter((r) => !r.read_at).length
  const total = recipientRows.length

  // Paginate
  const pageRows = recipientRows.slice(offset, offset + limit)
  const messageIds = pageRows.map((r) => r.message_id)

  // Fetch message content
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select(`
      id, subject, body, sent_at, program_id, sub_program_id, group_id,
      sender:profiles!messages_sender_id_fkey(id, first_name, last_name, email)
    `)
    .in('id', messageIds)
    .order('sent_at', { ascending: false })

  if (messagesError) {
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }

  // Merge read_at into each message
  const readAtMap = Object.fromEntries(pageRows.map((r) => [r.message_id, r.read_at]))
  const result = (messages ?? []).map((m) => ({
    ...m,
    read_at: readAtMap[m.id] ?? null,
  }))

  return NextResponse.json({ messages: result, unread_count: unreadCount, total })
}
