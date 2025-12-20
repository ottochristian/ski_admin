import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'
import { log } from '@/lib/logger'
import Stripe from 'stripe'

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  })
}

/**
 * Verify payment status with Stripe and update order if webhook didn't fire
 * This is a fallback mechanism for when webhooks don't work (local dev, webhook issues)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    log.info('[Verify Payment] Starting verification', { orderId })

    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      log.warn('[Verify Payment] Auth failed', { orderId })
      return authResult
    }

    const { user } = authResult
    log.info('[Verify Payment] User authenticated', { orderId, userId: user.id })
    
    const supabase = createSupabaseAdminClient()

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, total_amount, household_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify user owns this order
    const { data: guardian } = await supabase
      .from('household_guardians')
      .select('household_id')
      .eq('user_id', user.id)
      .single()

    if (!guardian || guardian.household_id !== order.household_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // If already paid, return success
    if (order.status === 'paid') {
      log.info('[Verify Payment] Order already paid', { orderId })
      return NextResponse.json({ 
        success: true, 
        status: 'paid',
        message: 'Order already marked as paid'
      })
    }

    log.info('[Verify Payment] Order status:', { orderId, status: order.status })

    // Check if there's a payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'succeeded')
      .single()

    log.info('[Verify Payment] Payment record check', { 
      orderId, 
      found: !!payment,
      error: paymentError?.message 
    })

    if (payment) {
      // Payment exists but order not updated - fix it
      log.info('[Verify Payment] Found successful payment, updating order status', { orderId })
      
      await supabase
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', orderId)

      // Update registrations
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('registration_id, amount')
        .eq('order_id', orderId)

      if (orderItems && orderItems.length > 0) {
        const updatePromises = orderItems.map((item: any) =>
          supabase
            .from('registrations')
            .update({
              status: 'confirmed',
              payment_status: 'paid',
              amount_paid: item.amount,
            })
            .eq('id', item.registration_id)
        )
        await Promise.all(updatePromises)
      }

      return NextResponse.json({ 
        success: true, 
        status: 'paid',
        message: 'Order status updated from payment record'
      })
    }

    // No payment record - check Stripe directly
    // Look for recent successful checkout sessions for this order
    log.info('[Verify Payment] Checking Stripe for checkout session', { orderId })
    
    const stripe = getStripe()
    
    // We need to search for checkout sessions with this order_id in metadata
    // Note: This is expensive, so only do it as a fallback
    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
    })

    log.info('[Verify Payment] Retrieved sessions from Stripe', { 
      orderId,
      sessionCount: sessions.data.length 
    })

    const matchingSession = sessions.data.find(
      (session) => session.metadata?.order_id === orderId && session.payment_status === 'paid'
    )

    log.info('[Verify Payment] Session search result', { 
      orderId,
      found: !!matchingSession,
      matchingSessionId: matchingSession?.id 
    })

    if (matchingSession) {
      log.info('[Verify Payment] Found paid session in Stripe, processing manually', {
        orderId,
        sessionId: matchingSession.id,
      })

      // Process it like the webhook would
      await supabase
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', orderId)

      // Create payment record
      await supabase.from('payments').insert([
        {
          order_id: orderId,
          amount: order.total_amount,
          method: 'stripe',
          status: 'succeeded',
          stripe_checkout_session_id: matchingSession.id,
          stripe_payment_intent_id: matchingSession.payment_intent as string,
          processed_at: new Date().toISOString(),
        },
      ])

      // Update registrations
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('registration_id, amount')
        .eq('order_id', orderId)

      if (orderItems && orderItems.length > 0) {
        const updatePromises = orderItems.map((item: any) =>
          supabase
            .from('registrations')
            .update({
              status: 'confirmed',
              payment_status: 'paid',
              amount_paid: item.amount,
            })
            .eq('id', item.registration_id)
        )
        await Promise.all(updatePromises)
      }

      return NextResponse.json({ 
        success: true, 
        status: 'paid',
        message: 'Payment verified with Stripe and order updated'
      })
    }

    // No payment found anywhere
    log.warn('[Verify Payment] No payment found', { orderId })
    return NextResponse.json({ 
      success: false, 
      status: order.status,
      message: 'No successful payment found'
    })

  } catch (error) {
    log.error('[Verify Payment] Error verifying payment', error)
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    )
  }
}
