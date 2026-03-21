import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/api-auth'
import { log } from '@/lib/logger'
import Stripe from 'stripe'

const postSchema = z.object({
  clubId: z.string().uuid(),
})

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  })
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// POST /api/admin/stripe/connect
// Body: { clubId: string }
// Auth: requireAdmin
// Returns: { accountId: string, onboardingUrl: string }
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

    // Verify caller's club matches clubId (system_admin can access any club)
    if (profile.role !== 'system_admin' && profile.club_id !== clubId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createSupabaseAdminClient()

    // Load club
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id, name, slug, contact_email, stripe_account_id, stripe_connect_status')
      .eq('id', clubId)
      .single()

    if (clubError || !club) {
      log.warn('Club not found for Stripe Connect', { clubId })
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    const stripe = getStripe()
    let accountId = club.stripe_account_id

    // Step 3: If no existing account, create one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: club.contact_email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
      accountId = account.id

      // Step 5: Save to DB
      const { error: updateError } = await supabase
        .from('clubs')
        .update({
          stripe_account_id: accountId,
          stripe_connect_status: 'pending',
        })
        .eq('id', clubId)

      if (updateError) {
        log.error('Failed to save Stripe account ID', updateError, { clubId, accountId })
        return NextResponse.json({ error: 'Failed to save Stripe account' }, { status: 500 })
      }

      log.info('Stripe Express account created', { clubId, accountId })
    }

    // Step 6: Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: `${BASE_URL}/clubs/${club.slug}/admin/settings/payments?stripe=return`,
      refresh_url: `${BASE_URL}/clubs/${club.slug}/admin/settings/payments?stripe=refresh`,
    })

    log.info('Stripe Connect onboarding link created', { clubId, accountId })

    return NextResponse.json({ accountId, onboardingUrl: accountLink.url })
  } catch (error) {
    log.error('Stripe Connect error', error)
    return NextResponse.json({ error: 'Failed to create Stripe Connect account' }, { status: 500 })
  }
}
