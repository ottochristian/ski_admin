import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { log } from '@/lib/logger'
import Stripe from 'stripe'
import { headers } from 'next/headers'

// Initialize Stripe only if secret key is available
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
  })
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * Stripe webhook handler with idempotency support.
 * Processes checkout.session.completed events and updates order/payment status.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    log.warn('Webhook received without signature')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    log.error('Webhook signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  // Check if event was already processed (idempotency)
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id, processed, error_message')
    .eq('stripe_event_id', event.id)
    .single()

  if (existingEvent?.processed) {
    log.info('Webhook event already processed', { eventId: event.id })
    return NextResponse.json({
      received: true,
      duplicate: true,
      message: 'Event already processed',
    })
  }

  // Record event (mark as processing)
  const { data: eventRecord, error: eventError } = await supabase
    .from('webhook_events')
    .upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      processed: false,
      metadata: event.data.object,
    })
    .select()
    .single()

  if (eventError && !eventRecord) {
    log.error('Failed to record webhook event', eventError, {
      eventId: event.id,
    })
    // Continue processing anyway - we'll log it
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id

    if (!orderId) {
      log.warn('No order_id in session metadata', {
        sessionId: session.id,
        eventId: event.id,
      })

      // Mark as processed even though we couldn't process it
      if (eventRecord) {
        await supabase
          .from('webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            error_message: 'No order_id in session metadata',
          })
          .eq('id', eventRecord.id)
      }

      return NextResponse.json({ received: true })
    }

    try {
      // Use a transaction-like approach: Check order status first
      const { data: order, error: orderFetchError } = await supabase
        .from('orders')
        .select('id, total_amount, status')
        .eq('id', orderId)
        .single()

      if (orderFetchError || !order) {
        log.error('Order not found', orderFetchError, { orderId })
        if (eventRecord) {
          await supabase
            .from('webhook_events')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: 'Order not found',
            })
            .eq('id', eventRecord.id)
        }
        return NextResponse.json({ received: true })
      }

      // Skip if already paid (idempotency at order level)
      if (order.status === 'paid') {
        log.info('Order already paid', { orderId })
        if (eventRecord) {
          await supabase
            .from('webhook_events')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq('id', eventRecord.id)
        }
        return NextResponse.json({ received: true, already_processed: true })
      }

      // Update order status
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (orderUpdateError) {
        log.error('Error updating order', orderUpdateError, { orderId })
        if (eventRecord) {
          await supabase
            .from('webhook_events')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: `Order update failed: ${orderUpdateError.message}`,
            })
            .eq('id', eventRecord.id)
        }
        return NextResponse.json({ received: true })
      }

      // Create payment record (check for existing first)
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_checkout_session_id', session.id)
        .single()

      if (!existingPayment) {
        const { error: paymentError } = await supabase.from('payments').insert([
          {
            order_id: orderId,
            amount: order.total_amount,
            method: 'stripe',
            status: 'succeeded',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
            processed_at: new Date().toISOString(),
          },
        ])

        if (paymentError) {
          log.error('Error creating payment record', paymentError, {
            orderId,
          })
        }
      }

      // Update registrations to confirmed
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('registration_id')
        .eq('order_id', orderId)

        if (orderItems) {
          const registrationIds = orderItems
            .map((item: any) => item.registration_id)
            .filter(Boolean) as string[]

        if (registrationIds.length > 0) {
          const { error: regError } = await supabase
            .from('registrations')
            .update({ status: 'confirmed' })
            .in('id', registrationIds)

          if (regError) {
            log.error('Error updating registrations', regError, {
              orderId,
              registrationIds,
            })
          }
        }
      }

      // Mark event as processed successfully
      if (eventRecord) {
        await supabase
          .from('webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('id', eventRecord.id)
      }

      log.info('Webhook processed successfully', {
        eventId: event.id,
        orderId,
        sessionId: session.id,
      })
    } catch (err) {
      log.error('Error processing webhook', err, {
        eventId: event.id,
        orderId: session.metadata?.order_id,
      })

      // Mark event as processed with error
      if (eventRecord) {
        await supabase
          .from('webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            error_message:
              err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', eventRecord.id)
      }
    }
  } else {
    // Other event types - just record them
    log.info('Unhandled webhook event type', { eventType: event.type })
    if (eventRecord) {
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('id', eventRecord.id)
    }
  }

  return NextResponse.json({ received: true })
}
