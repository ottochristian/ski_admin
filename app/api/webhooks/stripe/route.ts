import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { headers } from 'next/headers'

// Initialize Stripe only if secret key is available
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  })
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id

    if (!orderId) {
      console.error('No order_id in session metadata')
      return NextResponse.json({ received: true })
    }

    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (orderError) {
        console.error('Error updating order:', orderError)
        return NextResponse.json({ received: true })
      }

      // Create payment record
      const { data: order } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('id', orderId)
        .single()

      if (order) {
        await supabase.from('payments').insert([
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

        // Update registrations to confirmed
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('registration_id')
          .eq('order_id', orderId)

        if (orderItems) {
          const registrationIds = orderItems
            .map(item => item.registration_id)
            .filter(Boolean)

          if (registrationIds.length > 0) {
            await supabase
              .from('registrations')
              .update({ status: 'confirmed' })
              .in('id', registrationIds)
          }
        }
      }
    } catch (err) {
      console.error('Error processing webhook:', err)
    }
  }

  return NextResponse.json({ received: true })
}
