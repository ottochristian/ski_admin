import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { z } from 'zod'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const targetSchema = z.object({
  type: z.enum(['program', 'sub_program', 'group']),
  id: z.string().uuid(),
})

const sendSchema = z.object({
  clubSlug: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  // targets is optional when household_ids is provided
  targets: z.array(targetSchema).optional().default([]),
  // household_ids: target specific households directly (from nudge detection)
  household_ids: z.array(z.string().uuid()).optional(),
  season_id: z.string().uuid().optional(),
  additional_emails: z
    .array(z.string().regex(emailRegex, 'Invalid email'))
    .max(20, 'Max 20 additional recipients')
    .optional()
    .default([]),
}).refine(d => d.targets.length > 0 || (d.household_ids && d.household_ids.length > 0) || d.additional_emails.length > 0, {
  message: 'At least one recipient required',
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

  // Resolve target names for email footer
  const targetNames: string[] = []
  for (const t of body.targets) {
    if (t.type === 'program') {
      const { data } = await admin.from('programs').select('name').eq('id', t.id).single()
      if (data?.name) targetNames.push(data.name)
    } else if (t.type === 'sub_program') {
      const { data } = await admin.from('sub_programs').select('name').eq('id', t.id).single()
      if (data?.name) targetNames.push(data.name)
    } else {
      const { data } = await admin.from('groups').select('name').eq('id', t.id).single()
      if (data?.name) targetNames.push(data.name)
    }
  }
  const targetName = targetNames.join(', ')

  // For DB storage, record the first target (primary)
  const primaryTarget = body.targets[0] ?? null

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
      program_id: primaryTarget?.type === 'program' ? primaryTarget.id : null,
      sub_program_id: primaryTarget?.type === 'sub_program' ? primaryTarget.id : null,
      group_id: primaryTarget?.type === 'group' ? primaryTarget.id : null,
      direct_email_count: (body.additional_emails ?? []).length,
    })
    .select('id')
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }

  // Resolve household_ids — either from direct nudge targeting or from target-based resolution
  let householdIds: string[]

  if (body.household_ids && body.household_ids.length > 0) {
    // Direct household targeting (from nudge — only the specific affected families)
    householdIds = body.household_ids
  } else {
    // Target-based resolution (whole program/sub-program/group)
    const householdSet = new Set<string>()

    for (const t of body.targets) {
      let regs: any[] | null = null

      if (t.type === 'group') {
        const { data } = await admin
          .from('registrations')
          .select('athletes(household_id)')
          .eq('group_id', t.id)
        regs = data
      } else if (t.type === 'sub_program') {
        const { data } = await admin
          .from('registrations')
          .select('athletes(household_id)')
          .eq('sub_program_id', t.id)
        regs = data
      } else {
        const { data: sps } = await admin
          .from('sub_programs')
          .select('id')
          .eq('program_id', t.id)
        const spIds = sps?.map((s: { id: string }) => s.id) ?? []
        if (spIds.length > 0) {
          const { data } = await admin
            .from('registrations')
            .select('athletes(household_id)')
            .in('sub_program_id', spIds)
          regs = data
        }
      }

      for (const id of extractHouseholdIds(regs)) {
        householdSet.add(id)
      }
    }

    householdIds = [...householdSet]
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

  // Resolve merge fields per-recipient
  // Build a map of email → { parent_first_name, athlete_first_name }
  const mergeDataByEmail = new Map<string, { parent_first_name: string; athlete_first_name: string }>()

  if (householdIds.length > 0) {
    // Fetch athlete first names per household (take first athlete)
    const { data: athletes } = await admin
      .from('athletes')
      .select('household_id, first_name')
      .in('household_id', householdIds)
      .order('created_at', { ascending: true })

    const athleteByHousehold = new Map<string, string>()
    for (const a of athletes ?? []) {
      if (!athleteByHousehold.has(a.household_id)) {
        athleteByHousehold.set(a.household_id, a.first_name ?? 'your athlete')
      }
    }

    // Re-fetch guardians with first_name + household_id for merge data
    const { data: guardianDetails } = await admin
      .from('household_guardians')
      .select('household_id, user_id, profiles(first_name, email)')
      .in('household_id', householdIds)

    for (const g of guardianDetails ?? []) {
      const prof = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles
      const email = (prof as any)?.email
      const firstName = (prof as any)?.first_name ?? 'there'
      if (email) {
        mergeDataByEmail.set(email, {
          parent_first_name: firstName,
          athlete_first_name: athleteByHousehold.get(g.household_id) ?? 'your athlete',
        })
      }
    }
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(body.body)

  function resolveMerge(template: string, vars: { parent_first_name: string; athlete_first_name: string }): string {
    return template
      .replace(/\{\{parent_first_name\}\}/g, vars.parent_first_name)
      .replace(/\{\{athlete_first_name\}\}/g, vars.athlete_first_name)
      .replace(/\{\{club_name\}\}/g, club.name)
      .replace(/\{\{program_name\}\}/g, targetName)
  }

  function htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  // Send emails via Resend (registered + additional, each gets their own email)
  const resendKey = process.env.RESEND_API_KEY
  const additionalEmails = body.additional_emails ?? []
  const allEmails = [
    ...registeredEmails,
    ...additionalEmails.filter((e) => !registeredEmails.includes(e)),
  ]

  if (resendKey && allEmails.length > 0) {
    try {
      const resend = new Resend(resendKey)
      const senderName =
        [senderProfile.first_name, senderProfile.last_name].filter(Boolean).join(' ') ||
        senderProfile.email

      const htmlFooter = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">This message was sent to families in ${targetName} at ${club.name} by ${senderName}.</p>`
      const textFooter = `\n\n---\nThis message was sent to families in ${targetName} at ${club.name} by ${senderName}.`

      const BATCH = 50
      for (let i = 0; i < allEmails.length; i += BATCH) {
        const chunk = allEmails.slice(i, i + BATCH)
        await Promise.all(
          chunk.map((email) => {
            const mergeVars = mergeDataByEmail.get(email) ?? {
              parent_first_name: 'there',
              athlete_first_name: 'your athlete',
            }
            const personalizedSubject = resolveMerge(body.subject, mergeVars)
            const resolvedBody = resolveMerge(body.body, mergeVars)

            if (isHtml) {
              const htmlBody = resolvedBody + htmlFooter
              const textBody = htmlToText(resolvedBody) + textFooter
              return resend.emails.send({
                from: `${club.name} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@w110.io'}>`,
                replyTo: senderProfile.email,
                to: email,
                subject: `[${club.name}] ${personalizedSubject}`,
                html: htmlBody,
                text: textBody,
              })
            } else {
              return resend.emails.send({
                from: `${club.name} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@w110.io'}>`,
                replyTo: senderProfile.email,
                to: email,
                subject: `[${club.name}] ${personalizedSubject}`,
                text: resolvedBody + textFooter,
              })
            }
          })
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
