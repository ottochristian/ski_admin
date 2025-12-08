import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'
import { log } from '@/lib/logger'
import Stripe from 'stripe'

// Initialize Stripe only if secret key is available
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  })
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user, supabase: userSupabase } = authResult

    const { orderId, amount, clubSlug } = await request.json()

    if (!orderId || !amount || amount <= 0 || !clubSlug) {
      log.warn('Invalid checkout request', { orderId, amount, clubSlug })
      return NextResponse.json(
        { error: 'Invalid order information' },
        { status: 400 }
      )
    }

    // Use admin client to fetch order (since we need to verify ownership via household)
    const supabase = createSupabaseAdminClient()

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, households(id, primary_email)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      log.warn('Order not found', { orderId, error: orderError })
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify user has access to this order's household
    // Get user's household_id from their profile/household_guardians
    const { data: guardian } = await supabase
      .from('household_guardians')
      .select('household_id')
      .eq('user_id', user.id)
      .single()

    if (!guardian || guardian.household_id !== order.household_id) {
      log.warn('User attempted to access order they do not own', {
        userId: user.id,
        orderId,
        orderHouseholdId: order.household_id,
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create Stripe checkout session
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Registration Order #${orderId.slice(0, 8)}`,
              description: `Ski program registrations for ${clubSlug}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/clubs/${clubSlug}/parent/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/clubs/${clubSlug}/parent/cart?canceled=true`,
      metadata: {
        order_id: orderId,
        club_slug: clubSlug,
      },
      customer_email: (order.households as any)?.primary_email || undefined,
    })

    // Update order with checkout session ID
    await supabase
      .from('orders')
      .update({ 
        // Store checkout session ID temporarily (we'll update with payment intent in webhook)
      })
      .eq('id', orderId)

    log.info('Checkout session created', {
      orderId,
      sessionId: session.id,
      userId: user.id,
    })

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (error) {
    log.error('Checkout error', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
