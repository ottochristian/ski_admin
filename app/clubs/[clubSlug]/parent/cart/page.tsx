'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-context'
import { useParentClub } from '@/lib/use-parent-club'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { useRegistrations } from '@/lib/hooks/use-registrations'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, CreditCard, ShoppingCart } from 'lucide-react'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

export default function CartPage() {
  const params = useParams()
  const [supabase] = useState(() => createClient())

  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const { items, removeItem, clearCart, total } = useCart()
  const { clubId, household, athletes } = useParentClub()

  // PHASE 2: Use base useSeason hook - RLS handles filtering
  const currentSeason = useCurrentSeason()

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout() {
    if (!clubId || !household || !currentSeason || items.length === 0) {
      setError('Missing required information for checkout')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // PHASE 2: Use registrationsService or direct query - RLS handles filtering
      // 1. Check for existing CONFIRMED/ACTIVE registrations to prevent duplicates
      const existingRegistrations: Array<{ item: any; registration: any }> = []
      for (const item of items) {
        // RLS automatically filters by club - no need for clubQuery
        const { data: existing } = await supabase
          .from('registrations')
          .select('id, status')
          .eq('athlete_id', item.athlete_id)
          .eq('sub_program_id', item.sub_program_id)
          .eq('season_id', currentSeason.id)
          .maybeSingle()

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
          !existingRegistrations.some(
            (er) =>
              er.item.athlete_id === item.athlete_id &&
              er.item.sub_program_id === item.sub_program_id
          )
      )

      // 3. Create registrations via API route (bypasses RLS but verifies ownership)
      let allRegistrations = [
        ...existingRegistrations.map((er) => er.registration),
      ]

      if (itemsToCreate.length > 0) {
        const registrationsToCreate = itemsToCreate.map((item) => ({
          athlete_id: item.athlete_id,
          sub_program_id: item.sub_program_id,
          season_id: currentSeason.id,
          season: currentSeason.name, // Text column for backward compatibility
          status: 'pending', // Will be confirmed after payment
          club_id: clubId,
        }))

        // Get the session token to send with the request
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session?.access_token) {
          throw new Error('Authentication failed. Please log in again.')
        }

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        }

        const registrationsResponse = await fetch('/api/registrations/create', {
          method: 'POST',
          headers,
          credentials: 'include',
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
            errorData = {
              error:
                responseText ||
                `HTTP ${registrationsResponse.status}: ${registrationsResponse.statusText}`,
            }
          }

          const errorMessage =
            errorData.error ||
            errorData.message ||
            `Failed to create registrations (${registrationsResponse.status})`
          throw new Error(errorMessage)
        }

        const { registrations: newRegistrations } =
          await registrationsResponse.json()
        allRegistrations.push(...newRegistrations)
      }

      // 4. Create order - RLS handles filtering
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            household_id: household.id,
            club_id: clubId,
            season_id: currentSeason.id,
            total_amount: total,
            status: 'unpaid',
          },
        ])
        .select()
        .single()

      if (orderError || !order) {
        throw new Error(`Failed to create order: ${orderError?.message}`)
      }

      // 5. Create order items - RLS handles filtering
      const orderItems = allRegistrations.map((reg: any, index: number) => ({
        order_id: order.id,
        registration_id: reg.id,
        description: `${items[index].program_name} - ${items[index].sub_program_name} (${items[index].athlete_name})`,
        amount: items[index].price,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        throw new Error(`Failed to create order items: ${itemsError.message}`)
      }

      // 6. Clear cart and redirect to billing page
      clearCart()
      router.push(`/clubs/${clubSlug}/parent/billing?order=${order.id}`)
    } catch (err) {
      console.error('Error during checkout:', err)
      setError(err instanceof Error ? err.message : 'Failed to process checkout')
      setProcessing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <p className="text-muted-foreground">Your cart is empty</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Add programs to your cart to get started.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push(`/clubs/${clubSlug}/parent/programs`)}
            >
              Browse Programs
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Shopping Cart</h1>
        <p className="text-muted-foreground">
          Review your selections before checkout
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cart Items</CardTitle>
          <CardDescription>{items.length} item(s) in your cart</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{item.program_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.sub_program_name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Athlete: {item.athlete_name}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">${item.price.toFixed(2)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-2xl font-bold">${total.toFixed(2)}</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={processing || !currentSeason}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {processing ? 'Processing...' : 'Proceed to Checkout'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
