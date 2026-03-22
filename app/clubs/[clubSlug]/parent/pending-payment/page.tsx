'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { useParentClub } from '@/lib/use-parent-club'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type PendingReg = {
  id: string
  athlete_id: string
  sub_program_id: string
  athlete_name: string
  program_name: string
  sub_program_name: string
  registration_fee: number
}

export default function PendingPaymentPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string

  const { clubId, household, athletes } = useParentClub()
  const currentSeason = useCurrentSeason()

  // Stable string dep to avoid re-firing the effect when the athletes array reference changes
  const athleteIdList = athletes?.map((a) => a.id).join(',') ?? ''

  const [supabase] = useState(() => createClient())
  const [pendingRegs, setPendingRegs] = useState<PendingReg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (!household?.id || !currentSeason?.id || !athleteIdList) return
    const athleteIds = athleteIdList.split(',')

    async function loadPendingRegs() {
      setLoading(true)
      try {
        // Find pending registrations for this household that have no order_items
        const { data: regs } = await supabase
          .from('registrations')
          .select(`
            id,
            athlete_id,
            sub_program_id,
            sub_programs!inner(name, registration_fee, programs!inner(name))
          `)
          .eq('status', 'pending')
          .eq('season_id', currentSeason!.id)
          .in('athlete_id', athleteIds)

        if (!regs || regs.length === 0) {
          setPendingRegs([])
          setLoading(false)
          return
        }

        // Filter to only those without an existing order (promoted from waitlist, not cart)
        const regIds = regs.map((r: any) => r.id)
        const { data: existingItems } = await supabase
          .from('order_items')
          .select('registration_id')
          .in('registration_id', regIds)

        const alreadyOrdered = new Set((existingItems ?? []).map((i: any) => i.registration_id))
        const unordered = (regs as any[]).filter((r) => !alreadyOrdered.has(r.id))

        const athleteMap = new Map<string, string>(
          (athletes ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`] as [string, string])
        )

        const mapped: PendingReg[] = unordered.map((r) => ({
          id: r.id,
          athlete_id: r.athlete_id,
          sub_program_id: r.sub_program_id,
          athlete_name: athleteMap.get(r.athlete_id) ?? 'Unknown',
          program_name: r.sub_programs?.programs?.name ?? '',
          sub_program_name: r.sub_programs?.name ?? '',
          registration_fee: r.sub_programs?.registration_fee ?? 0,
        }))

        setPendingRegs(mapped)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pending registrations')
      } finally {
        setLoading(false)
      }
    }

    loadPendingRegs()
  }, [household?.id, currentSeason?.id, athleteIdList]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckout = useCallback(async () => {
    if (!household || !clubId || !currentSeason || pendingRegs.length === 0) return
    setProcessing(true)
    setError(null)

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication expired. Please log in again.')
      }
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      }

      const total = pendingRegs.reduce((sum, r) => sum + r.registration_fee, 0)

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          household_id: household.id,
          club_id: clubId,
          season_id: currentSeason.id,
          total_amount: total,
          status: 'unpaid',
        }])
        .select()
        .single()

      if (orderError || !order) throw new Error(`Failed to create order: ${orderError?.message}`)

      setOrderId(order.id)

      // Create order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(
          pendingRegs.map((r) => ({
            order_id: order.id,
            registration_id: r.id,
            description: `${r.program_name} — ${r.sub_program_name} (${r.athlete_name})`,
            amount: r.registration_fee,
          }))
        )

      if (itemsError) throw new Error(`Failed to create order items: ${itemsError.message}`)

      // Create Stripe checkout session
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId: order.id, amount: total, clubSlug }),
      })

      if (!checkoutRes.ok) {
        const data = await checkoutRes.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to initialize payment')
      }

      const { clientSecret } = await checkoutRes.json()
      setCheckoutClientSecret(clientSecret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setProcessing(false)
    }
  }, [household, clubId, currentSeason, pendingRegs, clubSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (checkoutClientSecret && orderId) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="page-title">Complete Registration</h1>
        </div>
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{ clientSecret: checkoutClientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="page-title">Complete Registration</h1>
          <p className="text-muted-foreground">
            You&apos;ve been moved off the waitlist — please pay to secure your spot.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pendingRegs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No pending registrations to pay for.</p>
            <Link href={`/clubs/${clubSlug}/parent/dashboard`} className="mt-4 inline-block">
              <Button variant="outline" size="sm">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pending Registrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/20 border border-red-900/40 rounded-md px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              {pendingRegs.map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{reg.athlete_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {reg.program_name} — {reg.sub_program_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-yellow-700 text-yellow-400 text-xs">
                      Awaiting Payment
                    </Badge>
                    <span className="text-sm font-medium">
                      ${reg.registration_fee.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-medium">Total</span>
              <span className="text-base font-semibold">
                ${pendingRegs.reduce((sum, r) => sum + r.registration_fee, 0).toFixed(2)}
              </span>
            </div>

            <Button
              className="w-full"
              disabled={processing}
              onClick={handleCheckout}
            >
              {processing ? 'Preparing checkout…' : 'Pay Now'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
