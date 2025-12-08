'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-context'
import { useParentClub } from '@/lib/use-parent-club'
// Removed useAdminSeason - it requires admin role
import { supabase } from '@/lib/supabaseClient'
import { clubQuery } from '@/lib/supabase-helpers'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, CreditCard, ShoppingCart } from 'lucide-react'

export default function CartPage() {
  const params = useParams()
  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const { items, removeItem, clearCart, total } = useCart()
  const { clubId, household, athletes } = useParentClub()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<{ id: string; name: string } | null>(null)

  // Load current season
  useEffect(() => {
    async function loadSeason() {
      if (!clubId) return

      const { data: seasonData } = await supabase
        .from('seasons')
        .select('id, name')
        .eq('club_id', clubId)
        .eq('is_current', true)
        .single()

      if (seasonData) {
        setSelectedSeason(seasonData)
      }
    }

    loadSeason()
  }, [clubId])

  async function handleCheckout() {
    if (!clubId || !household || !selectedSeason || items.length === 0) {
      setError('Missing required information for checkout')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // 1. Check for existing CONFIRMED/ACTIVE registrations to prevent duplicates
      // Allow pending registrations to proceed to checkout (they need payment)
      const existingRegistrations: Array<{ item: any; registration: any }> = []
      for (const item of items) {
        const { data: existing } = await clubQuery(
          supabase
            .from('registrations')
            .select('id, status')
            .eq('athlete_id', item.athlete_id)
            .eq('sub_program_id', item.sub_program_id)
            .eq('season_id', selectedSeason.id)
            .maybeSingle(),
          clubId
        )

        if (existing) {
          // Block confirmed/active registrations
          if (existing.status === 'confirmed' || existing.status === 'active') {
            throw new Error(
              `${item.athlete_name} is already registered for ${item.program_name} - ${item.sub_program_name}. Please remove it from your cart.`
            )
          }
          // Allow pending registrations - we'll use the existing one
          existingRegistrations.push({ item, registration: existing })
        }
      }

      // 2. Filter out items that already have pending registrations
      const itemsToCreate = items.filter(
        (item) =>
          !existingRegistrations.some((er) => er.item.athlete_id === item.athlete_id && er.item.sub_program_id === item.sub_program_id)
      )

      // 3. Create registrations via API route (bypasses RLS but verifies ownership)
      // Only create registrations for items that don't already have pending ones
      let allRegistrations = [...existingRegistrations.map((er) => er.registration)]

      if (itemsToCreate.length > 0) {
        const registrationsToCreate = itemsToCreate.map((item) => ({
        athlete_id: item.athlete_id,
        sub_program_id: item.sub_program_id,
        season_id: selectedSeason.id,
        season: selectedSeason.name, // Legacy column - will be removed in cleanup migration
        status: 'pending', // Will be confirmed after payment
        club_id: clubId,
      }))

      // Get the session token to send with the request
      // Using the same supabase client instance that's used throughout the app
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Error getting session:', sessionError)
        throw new Error('Authentication failed. Please log in again.')
      }

      if (!session) {
        console.error('No active session found')
        throw new Error('No active session. Please log in again.')
      }

      if (!session.access_token) {
        console.error('Session exists but no access_token')
        throw new Error('Invalid session. Please log in again.')
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      }

      const registrationsResponse = await fetch('/api/registrations/create', {
        method: 'POST',
        headers,
        credentials: 'include', // Ensure cookies are sent
        body: JSON.stringify({
          registrations: registrationsToCreate,
          clubId,
        }),
      })

      if (!registrationsResponse.ok) {
        let errorData: any = {}
        const responseText = await registrationsResponse.text()
        try {
          errorData = JSON.parse(responseText)
        } catch {
          errorData = { error: responseText || `HTTP ${registrationsResponse.status}: ${registrationsResponse.statusText}` }
        }
        
        console.error('Registration creation failed:', {
          status: registrationsResponse.status,
          statusText: registrationsResponse.statusText,
          responseText,
          errorData,
        })
        
        const errorMessage = errorData.error || errorData.message || `Failed to create registrations (${registrationsResponse.status})`
        throw new Error(errorMessage)
      }

        const { registrations: newRegistrations } = await registrationsResponse.json()
        allRegistrations.push(...newRegistrations)
      }

      // Use all registrations (existing pending + newly created) for order
      const registrations = allRegistrations

      // 4. Create order
      const { data: order, error: orderError } = await clubQuery(
        supabase
          .from('orders')
          .insert([
            {
              household_id: household.id,
              club_id: clubId,
              season_id: selectedSeason.id,
              total_amount: total,
              status: 'unpaid',
            },
          ])
          .select()
          .single(),
        clubId
      )

      if (orderError || !order) {
        throw new Error(`Failed to create order: ${orderError?.message}`)
      }

      // 5. Create order items
      const orderItems = registrations.map((reg: any, index: number) => ({
        order_id: order.id,
        registration_id: reg.id,
        description: `${items[index].program_name} - ${items[index].sub_program_name} (${items[index].athlete_name})`,
        amount: items[index].price,
      }))

      const { error: itemsError } = await clubQuery(
        supabase.from('order_items').insert(orderItems),
        clubId
      )

      if (itemsError) {
        throw new Error(`Failed to create order items: ${itemsError.message}`)
      }

      // 6. Redirect to Stripe checkout
      // Get session token again for the checkout API call
      const {
        data: { session: checkoutSession },
      } = await supabase.auth.getSession()

      if (!checkoutSession?.access_token) {
        throw new Error('No active session. Please log in again.')
      }

      const checkoutHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${checkoutSession.access_token}`,
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: checkoutHeaders,
        credentials: 'include',
        body: JSON.stringify({
          orderId: order.id,
          amount: total,
          clubSlug,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const { checkoutUrl } = await response.json()

      // Clear cart and redirect to Stripe
      clearCart()
      window.location.href = checkoutUrl
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process checkout')
      setProcessing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cart</h1>
          <p className="text-muted-foreground">Your registration cart</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Your cart is empty</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse programs and add registrations to your cart.
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push(`/clubs/${clubSlug}/parent/programs`)}
              >
                Browse Programs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cart</h1>
        <p className="text-muted-foreground">
          Review your registrations before checkout
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Registrations</CardTitle>
              <CardDescription>
                {items.length} registration{items.length !== 1 ? 's' : ''} in your cart
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {item.program_name} - {item.sub_program_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Athlete: {item.athlete_name}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${total.toFixed(2)}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">${total.toFixed(2)}</span>
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={processing || !selectedSeason}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {processing ? 'Processing…' : 'Proceed to Checkout'}
              </Button>
              {!selectedSeason && (
                <p className="text-xs text-muted-foreground">
                  No season selected. Please select a season first.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
