'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { useCart } from '@/lib/cart-context'
import { useParentClub } from '@/lib/use-parent-club'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { useWaivers } from '@/lib/hooks/use-waivers'
import { createClient } from '@/lib/supabase/client'
import { WaiverSignDialog } from '@/components/waiver-sign-dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Trash2,
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  PenLine,
  Lock,
  Tag,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type WaiverInfo = { id: string; title: string; required?: boolean; status?: string }
type WaiverStatusRow = { waiver_id: string; status: string; signed_at: string | null }

export default function CartPage() {
  const params = useParams()
  const router = useRouter()
  const clubSlug = params.clubSlug as string

  const [supabase] = useState(() => createClient())
  const { items, removeItem, total, clearCart } = useCart()
  const { clubId, household, athletes, profile } = useParentClub()
  const currentSeason = useCurrentSeason()
  const queryClient = useQueryClient()

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitlistConfirmed, setWaitlistConfirmed] = useState(false)

  // Discount code state
  const [discountInput, setDiscountInput] = useState('')
  const [validatingCode, setValidatingCode] = useState(false)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [appliedDiscount, setAppliedDiscount] = useState<{
    codeId: string
    code: string
    discountCents: number
    description: string
  } | null>(null)

  // Stripe embedded checkout state
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null)

  // Waiver data
  const { data: waivers = [], isLoading: waiversListLoading } = useWaivers(currentSeason?.id)
  const requiredWaivers = (waivers as WaiverInfo[]).filter(
    (w: WaiverInfo) => w.required && w.status === 'active'
  )

  // Per-athlete waiver signature status
  const [waiverSigned, setWaiverSigned] = useState<Record<string, boolean>>({})
  const [waiverDetails, setWaiverDetails] = useState<Record<string, WaiverStatusRow[]>>({})
  const [waiversLoading, setWaiversLoading] = useState(false)
  const [selectedWaiver, setSelectedWaiver] = useState<{ waiverId: string; athleteId: string } | null>(null)

  const paidItems = items.filter((i) => !i.isWaitlisted)
  const athleteIds = [...new Set(paidItems.map((i) => i.athlete_id))]

  const checkWaivers = useCallback(async () => {
    if (!currentSeason?.id || athleteIds.length === 0) {
      setWaiverSigned({})
      setWaiversLoading(false)
      return
    }
    setWaiversLoading(true)
    const signed: Record<string, boolean> = {}
    const details: Record<string, WaiverStatusRow[]> = {}

    await Promise.all(
      athleteIds.map(async (athleteId) => {
        const [{ data: rpcData }, { data: statusData }] = await Promise.all([
          supabase.rpc('has_signed_required_waivers', {
            p_athlete_id: athleteId,
            p_season_id: currentSeason.id,
          }),
          supabase
            .from('athlete_waiver_status')
            .select('waiver_id, status, signed_at')
            .eq('athlete_id', athleteId),
        ])
        signed[athleteId] = rpcData === true
        details[athleteId] = (statusData ?? []) as WaiverStatusRow[]
      })
    )

    setWaiverSigned(signed)
    setWaiverDetails(details)
    setWaiversLoading(false)
  }, [athleteIds.join(','), currentSeason?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    checkWaivers()
  }, [checkWaivers])

  const allWaiversSigned =
    paidItems.length === 0 ||
    requiredWaivers.length === 0 ||
    athleteIds.every((id) => waiverSigned[id] === true)

  // Group cart items by athlete
  const itemsByAthlete = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.athlete_id]) acc[item.athlete_id] = []
    acc[item.athlete_id].push(item)
    return acc
  }, {})

  const discountedTotal = appliedDiscount
    ? Math.max(0, total - appliedDiscount.discountCents / 100)
    : total

  async function handleApplyCode() {
    if (!discountInput.trim() || !clubId || !household) return
    setDiscountError(null)
    setValidatingCode(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          code: discountInput.trim(),
          clubId,
          householdId: household.id,
          orderAmountCents: Math.round(total * 100),
          athleteIds: [...new Set(items.map((i) => i.athlete_id))],
        }),
      })
      const json = await res.json()
      if (json.valid) {
        setAppliedDiscount({
          codeId: json.codeId,
          code: discountInput.trim().toUpperCase(),
          discountCents: json.discountCents,
          description: json.description,
        })
        setDiscountInput('')
      } else {
        setDiscountError(json.reason || 'Invalid code')
      }
    } catch {
      setDiscountError('Failed to validate code')
    } finally {
      setValidatingCode(false)
    }
  }

  async function handleCheckout() {
    if (!clubId || !household || !currentSeason || items.length === 0) {
      setError('Missing required information for checkout')
      return
    }
    setProcessing(true)
    setError(null)

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication expired. Please log in again.')
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      }

      // 1. Check for existing confirmed registrations (prevent duplicates) — paid items only
      for (const item of paidItems) {
        const { data: existing } = await supabase
          .from('registrations')
          .select('id, status')
          .eq('athlete_id', item.athlete_id)
          .eq('sub_program_id', item.sub_program_id)
          .eq('season_id', currentSeason.id)
          .maybeSingle()

        if (existing?.status === 'confirmed' || existing?.status === 'active') {
          throw new Error(
            `${item.athlete_name} is already registered for ${item.program_name} — ${item.sub_program_name}. Please remove it from your cart.`
          )
        }
      }

      // 2. Create all registrations via API.
      //    Paid items → 'pending'; waitlist items → 'waitlisted'.
      //    Server enforces capacity and may promote 'pending' → 'waitlisted' on race conditions.
      const registrationsResponse = await fetch('/api/registrations/create', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          registrations: items.map((item) => ({
            athlete_id: item.athlete_id,
            sub_program_id: item.sub_program_id,
            season_id: currentSeason.id,
            status: item.isWaitlisted ? 'waitlisted' : 'pending',
            club_id: clubId,
          })),
          clubId,
        }),
      })

      if (!registrationsResponse.ok) {
        let msg = `HTTP ${registrationsResponse.status}`
        try {
          const body = await registrationsResponse.json()
          msg = body.error || body.message || msg
        } catch { /* ignore */ }
        throw new Error(msg)
      }

      const responseData = await registrationsResponse.json()
      const allRegistrations: { id: string; sub_program_id: string; athlete_id: string; status: string }[] =
        responseData.registrations
      if (!Array.isArray(allRegistrations) || allRegistrations.length === 0) {
        throw new Error('Registration API returned unexpected response. Please try again.')
      }

      // Invalidate registrations cache
      await queryClient.invalidateQueries({ queryKey: ['registrations', currentSeason.id] })

      // Match created registrations back to cart items by athlete + sub_program
      function findReg(item: typeof items[0]) {
        return allRegistrations.find(
          (r) => r.sub_program_id === item.sub_program_id && r.athlete_id === item.athlete_id
        )
      }

      // 3. If there are no paid items (waitlist-only cart), we're done — show confirmation
      if (paidItems.length === 0) {
        clearCart()
        setWaitlistConfirmed(true)
        return
      }

      // Check if server bumped any paid items to waitlisted due to race condition
      const serverWaitlisted = paidItems.filter((item) => {
        const reg = findReg(item)
        return reg?.status === 'waitlisted'
      })
      if (serverWaitlisted.length > 0) {
        const names = serverWaitlisted.map((i) => `${i.athlete_name} (${i.sub_program_name})`).join(', ')
        throw new Error(
          `A spot was just taken for: ${names}. They have been added to the waitlist instead. Please review your cart and try again.`
        )
      }

      // 4. Create order for paid items only
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

      if (orderError || !order) {
        throw new Error(`Failed to create order: ${orderError?.message}`)
      }

      // 5. Create order items for paid registrations only
      const paidRegs = paidItems
        .map((item) => ({ item, reg: findReg(item) }))
        .filter((x): x is { item: typeof items[0]; reg: typeof allRegistrations[0] } => !!x.reg)

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(
          paidRegs.map(({ item, reg }) => ({
            order_id: order.id,
            registration_id: reg.id,
            description: `${item.program_name} — ${item.sub_program_name} (${item.athlete_name})`,
            amount: item.price,
          }))
        )

      if (itemsError) {
        throw new Error(`Failed to create order items: ${itemsError.message}`)
      }

      // 6. Apply discount code if one is set
      let finalTotal = total
      if (appliedDiscount) {
        const applyRes = await fetch('/api/discount-codes/apply', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            codeId: appliedDiscount.codeId,
            orderId: order.id,
            householdId: household.id,
            discountCents: appliedDiscount.discountCents,
            codeText: appliedDiscount.code,
          }),
        })
        if (applyRes.ok) {
          const applyJson = await applyRes.json()
          finalTotal = applyJson.newTotalCents / 100
        }
        // If apply fails (e.g. code just expired), continue at full price
      }

      // 7. Invalidate cache
      await queryClient.invalidateQueries({ queryKey: ['orders', household.id, currentSeason.id] })

      // 8. Fetch Stripe clientSecret — show embedded checkout in this page
      const checkoutResponse = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId: order.id, amount: finalTotal, clubSlug }),
      })

      if (!checkoutResponse.ok) {
        const data = await checkoutResponse.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to initialize payment')
      }

      const { clientSecret } = await checkoutResponse.json()

      // Clear cart now that order is created; Stripe handles the rest
      clearCart()
      setCheckoutClientSecret(clientSecret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process checkout')
      setProcessing(false)
    }
  }

  // ── Embedded checkout (after order created) ──────────────────────────────────

  if (checkoutClientSecret) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCheckoutClientSecret(null)
              router.push(`/clubs/${clubSlug}/parent/programs`)
            }}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to programs
          </button>
        </div>
        <div>
          <h1 className="text-3xl font-bold">Complete Payment</h1>
          <p className="text-sm text-muted-foreground mt-1">Secure checkout powered by Stripe</p>
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

  // ── Waitlist-only confirmation screen ────────────────────────────────────────

  if (waitlistConfirmed) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">You&apos;re on the waitlist!</h1>
          <p className="mt-1 text-muted-foreground">
            We&apos;ll notify you if a spot opens up.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-950/40 border border-purple-700">
              <CheckCircle className="h-7 w-7 text-purple-400" />
            </div>
            <div>
              <p className="font-semibold text-lg">Waitlist confirmed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No payment is required yet. If a spot opens, you&apos;ll receive an email with
                instructions to complete your registration.
              </p>
            </div>
            <Button onClick={() => router.push(`/clubs/${clubSlug}/parent/programs`)}>
              Browse more programs
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Empty cart ───────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold">Your Cart</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Button onClick={() => router.push(`/clubs/${clubSlug}/parent/programs`)}>
              Browse Programs
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/clubs/${clubSlug}/parent/programs`}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Programs
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Your Cart</h1>
          <p className="text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: items grouped by athlete */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {Object.entries(itemsByAthlete).map(([athleteId, athleteItems]) => {
            const athlete = athletes?.find((a) => a.id === athleteId)
            const hasSigned = waiverSigned[athleteId] ?? true
            const athleteStatus = waiverDetails[athleteId] ?? []
            const athleteTotal = athleteItems.reduce((s, i) => s + i.price, 0)

            return (
              <Card key={athleteId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {athlete ? `${athlete.first_name} ${athlete.last_name}` : 'Athlete'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {waiversLoading || waiversListLoading ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Checking waivers…</Badge>
                      ) : requiredWaivers.length === 0 ? null : hasSigned ? (
                        <Badge className="gap-1 bg-green-950/30 text-green-400 text-xs border-green-800/40">
                          <CheckCircle className="h-3 w-3" /> Waivers signed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs text-orange-400 border-orange-700 bg-orange-950/20">
                          <AlertCircle className="h-3 w-3" /> Waivers needed
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2 pb-4">
                  {athleteItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5',
                        item.isWaitlisted
                          ? 'border-purple-800/40 bg-purple-950/20'
                          : 'bg-muted/30'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{item.program_name}</p>
                          {item.isWaitlisted && (
                            <Badge variant="outline" className="shrink-0 text-xs border-purple-700 text-purple-400">
                              Waitlist
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{item.sub_program_name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold">
                          {item.isWaitlisted ? 'Free' : `$${item.price.toFixed(2)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Waiver signing — non-blocking, shown inline */}
                  {!waiversLoading && !waiversListLoading && !hasSigned && requiredWaivers.length > 0 && (
                    <div className="mt-3 space-y-2 rounded-md border border-orange-800/40 bg-orange-950/20 p-3">
                      <p className="text-xs font-medium text-orange-400">
                        Sign required waivers before proceeding:
                      </p>
                      {requiredWaivers.map((w) => {
                        const signed = athleteStatus.find(
                          (s) => s.waiver_id === w.id && s.status === 'signed'
                        )
                        return (
                          <div key={w.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-orange-300">{w.title}</span>
                            {signed ? (
                              <span className="flex items-center gap-1 text-xs text-green-400">
                                <CheckCircle className="h-3 w-3" /> Signed
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 gap-1 border-orange-700 bg-transparent px-2 text-xs text-orange-400 hover:bg-orange-950/30"
                                onClick={() =>
                                  athlete && setSelectedWaiver({ waiverId: w.id, athleteId: athlete.id })
                                }
                              >
                                <PenLine className="h-3 w-3" />
                                Sign
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex justify-end pt-1 text-sm text-muted-foreground">
                    Subtotal: <span className="ml-1 font-semibold text-foreground">${athleteTotal.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Right: order summary */}
        <div className="flex flex-col gap-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Line items */}
              <div className="space-y-1.5 text-sm">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {item.athlete_name.split(' ')[0]} — {item.sub_program_name}
                    </span>
                    <span className="shrink-0 font-medium">${item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Promo code */}
              {appliedDiscount ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-green-800/40 bg-green-950/20 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    <div>
                      <span className="font-mono font-semibold text-green-400">{appliedDiscount.code}</span>
                      <p className="text-xs text-green-600">{appliedDiscount.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-green-400 font-semibold">
                      −${(appliedDiscount.discountCents / 100).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAppliedDiscount(null)}
                      className="text-zinc-500 hover:text-zinc-300"
                      title="Remove code"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Promo code"
                      value={discountInput}
                      onChange={(e) => {
                        setDiscountInput(e.target.value.toUpperCase())
                        setDiscountError(null)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCode()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyCode}
                      disabled={!discountInput.trim() || validatingCode}
                      className="shrink-0"
                    >
                      {validatingCode ? '…' : 'Apply'}
                    </Button>
                  </div>
                  {discountError && (
                    <p className="text-xs text-red-400">{discountError}</p>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <div className="text-right">
                  {appliedDiscount && (
                    <p className="text-xs text-muted-foreground line-through">${total.toFixed(2)}</p>
                  )}
                  <span className="text-xl">${discountedTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Waiver warning — non-blocking but prominent */}
              {!waiversLoading && !waiversListLoading && !allWaiversSigned && requiredWaivers.length > 0 && (
                <div className="rounded-md border border-orange-800/40 bg-orange-950/20 px-3 py-2 text-xs text-orange-400">
                  <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                  Please sign all waivers above before proceeding.
                </div>
              )}

              <Button
                className={cn(
                  'w-full gap-2 h-12 text-base font-semibold text-foreground',
                  paidItems.length === 0
                    ? 'bg-purple-700 hover:bg-purple-800'
                    : 'bg-green-600 hover:bg-green-700'
                )}
                size="lg"
                onClick={handleCheckout}
                disabled={processing || !currentSeason || !allWaiversSigned}
              >
                <Lock className="h-4 w-4" />
                {processing
                  ? (paidItems.length === 0 ? 'Joining waitlist…' : 'Preparing payment…')
                  : (paidItems.length === 0 ? 'Join Waitlist' : 'Continue to Payment')}
              </Button>
              {paidItems.length > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  🔒 Secure checkout powered by Stripe
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Waiver sign dialog */}
      {selectedWaiver && profile && waivers.length > 0 && (
        (() => {
          const athlete = athletes?.find((a) => a.id === selectedWaiver.athleteId)
          const waiver = waivers.find((w: WaiverInfo) => w.id === selectedWaiver.waiverId)
          if (!athlete || !waiver) return null
          return (
            <WaiverSignDialog
              open
              onOpenChange={(open) => !open && setSelectedWaiver(null)}
              waiver={waiver}
              athlete={athlete}
              guardianId={profile.id}
              guardianName={`${profile.first_name} ${profile.last_name}`}
              onSignatureComplete={() => {
                setSelectedWaiver(null)
                checkWaivers()
              }}
            />
          )
        })()
      )}
    </div>
  )
}
