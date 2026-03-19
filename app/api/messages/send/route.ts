import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { z } from 'zod'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sendSchema = z.object({
  clubSlug: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  target_type: z.enum(['program', 'sub_program', 'group']),
  target_id: z.string().uuid(),
  season_id: z.string().uuid().optional(),
  additional_emails: z
    .array(z.string().regex(emailRegex, 'Invalid email'))
    .max(20, 'Max 20 additional recipients')
    .optional()
    .default([]),
})

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  let body: z.infer<typeof sendSchema>
  try {
    body = sendSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // Verify sender is coach or admin for this club
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('role, club_id, first_name, last_name, email')
    .eq('id', user.id)
    .single()

  if (!senderProfile || !['coach', 'admin', 'system_admin'].includes(senderProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Resolve club
  const { data: club } = await admin
    .from('clubs')
    .select('id, name, primary_color')
    .eq('slug', body.clubSlug)
    .single()

  if (!club) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  // Extra guard: coach must belong to this club
  if (senderProfile.role === 'coach' && senderProfile.club_id !== club.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Resolve target name for email footer
  let targetName = ''
  if (body.target_type === 'program') {
    const { data } = await admin.from('programs').select('name').eq('id', body.target_id).single()
    targetName = data?.name ?? ''
  } else if (body.target_type === 'sub_program') {
    const { data } = await admin.from('sub_programs').select('name').eq('id', body.target_id).single()
    targetName = data?.name ?? ''
  } else {
    const { data } = await admin.from('groups').select('name').eq('id', body.target_id).single()
    targetName = data?.name ?? ''
  }

  // Insert message
  const { data: message, error: msgError } = await admin
    .from('messages')
    .insert({
      sender_id: user.id,
      subject: body.subject,
      body: body.body,
      club_id: club.id,
      season_id: body.season_id ?? null,
      message_type: 'broadcast',
      program_id: body.target_type === 'program' ? body.target_id : null,
      sub_program_id: body.target_type === 'sub_program' ? body.target_id : null,
      group_id: body.target_type === 'group' ? body.target_id : null,
    })
    .select('id')
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  // Resolve household_ids from registrations
  let householdIds: string[] = []

  if (body.target_type === 'group') {
    const { data: regs } = await admin
      .from('registrations')
      .select('athletes(household_id)')
      .eq('group_id', body.target_id)
    householdIds = extractHouseholdIds(regs)
  } else if (body.target_type === 'sub_program') {
    const { data: regs } = await admin
      .from('registrations')
      .select('athletes(household_id)')
      .eq('sub_program_id', body.target_id)
    householdIds = extractHouseholdIds(regs)
  } else {
    // program — get all sub_programs first
    const { data: sps } = await admin
      .from('sub_programs')
      .select('id')
      .eq('program_id', body.target_id)
    const spIds = sps?.map((s: { id: string }) => s.id) ?? []
    if (spIds.length > 0) {
      const { data: regs } = await admin
        .from('registrations')
        .select('athletes(household_id)')
        .in('sub_program_id', spIds)
      householdIds = extractHouseholdIds(regs)
    }
  }

  // Resolve user_ids from household_guardians
  let userIds: string[] = []
  let registeredEmails: string[] = []

  if (householdIds.length > 0) {
    const { data: guardians } = await admin
      .from('household_guardians')
      .select('user_id, profiles(email)')
      .in('household_id', householdIds)

    userIds = [...new Set(guardians?.map((g: { user_id: string }) => g.user_id).filter(Boolean) as string[])]

    if (userIds.length > 0) {
      await admin.from('message_recipients').insert(
        userIds.map((uid) => ({ message_id: message.id, recipient_id: uid }))
      )
    }

    // Collect emails from registered guardians (deduped)
    const seen = new Set<string>()
    for (const g of guardians ?? []) {
      const profile = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles
      const email = (profile as any)?.email
      if (email && !seen.has(email)) {
        seen.add(email)
        registeredEmails.push(email)
      }
    }
  }

  // Send emails via Resend (registered + additional, each gets their own email)
  const resendKey = process.env.RESEND_API_KEY
  const additionalEmails = body.additional_emails ?? []
  const allEmails = [
    ...registeredEmails,
    // Dedupe additional against registered
    ...additionalEmails.filter((e) => !registeredEmails.includes(e)),
  ]

  if (resendKey && allEmails.length > 0) {
    try {
      const resend = new Resend(resendKey)
      const senderName =
        [senderProfile.first_name, senderProfile.last_name].filter(Boolean).join(' ') ||
        senderProfile.email

      const emailBody = `${body.body}\n\n---\nThis message was sent to families in ${targetName} at ${club.name} by ${senderName}.`

      // Batch in chunks of 50
      const BATCH = 50
      for (let i = 0; i < allEmails.length; i += BATCH) {
        const chunk = allEmails.slice(i, i + BATCH)
        await Promise.all(
          chunk.map((email) =>
            resend.emails.send({
              from: `${club.name} <noreply@west110.com>`,
              replyTo: senderProfile.email,
              to: email,
              subject: `[${club.name}] ${body.subject}`,
              text: emailBody,
            })
          )
        )
      }

      await admin
        .from('messages')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', message.id)
    } catch (emailErr) {
      console.error('Email delivery error:', emailErr)
    }
  }

  return NextResponse.json({
    success: true,
    message_id: message.id,
    recipient_count: userIds.length,
    additional_email_count: additionalEmails.length,
  })
}

function extractHouseholdIds(regs: any[] | null): string[] {
  if (!regs) return []
  const ids = regs.map((r) => {
    const athlete = Array.isArray(r.athletes) ? r.athletes[0] : r.athletes
    return athlete?.household_id
  })
  return [...new Set(ids.filter(Boolean) as string[])]
}
