'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import { useParentClub } from '@/lib/use-parent-club'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { useRegistrations } from '@/lib/hooks/use-registrations'
import { useWaivers, useAthleteWaiverStatus, useHasSignedRequiredWaivers } from '@/lib/hooks/use-waivers'
import { createClient } from '@/lib/supabase/client'
import { WaiverSignDialog } from '@/components/waiver-sign-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, CreditCard, ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

// Component to show waiver list for an athlete
function AthleteWaiverList({ 
  athlete, 
  requiredWaivers, 
  onSignWaiver,
  athleteWaiverStatus = []
}: { 
  athlete: any
  requiredWaivers: any[]
  onSignWaiver: (waiverId: string) => void
  athleteWaiverStatus?: any[]
}) {
  return (
    <div className="ml-4 space-y-2 border-l-2 border-orange-200 pl-4">
      {requiredWaivers.map((waiver: any) => {
        const signedStatus = athleteWaiverStatus.find(
          (status: any) => status.waiver_id === waiver.id && status.status === 'signed'
        )
        const isSigned = !!signedStatus

        return (
          <div
            key={`${athlete.id}-${waiver.id}`}
            className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{waiver.title}</span>
                {isSigned ? (
                  <Badge variant="default" className="bg-green-600 text-white text-xs">
                    Signed
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    Signature Required
                  </Badge>
                )}
              </div>
              {isSigned && signedStatus.signed_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Signed on {new Date(signedStatus.signed_at).toLocaleDateString()}
                </p>
              )}
            </div>
            {!isSigned && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onSignWaiver(waiver.id)}
              >
                Sign Waiver
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function CartPage() {
  const params = useParams()
  const [supabase] = useState(() => createClient())

  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const { items, removeItem, clearCart, total } = useCart()
  const { clubId, household, athletes, profile } = useParentClub()

  // PHASE 2: Use base useSeason hook - RLS handles filtering
  const currentSeason = useCurrentSeason()

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Get unique athlete IDs from cart items
  const athleteIds = [...new Set(items.map(item => item.athlete_id))]

  // Get waivers for current season
  const { data: waivers = [], isLoading: loadingWaiversList } = useWaivers(currentSeason?.id)
  const requiredWaivers = waivers.filter((w: any) => w.required && w.status === 'active')

  // Debug logging
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/cart/page.tsx:47',message:'Cart waiver state',data:{currentSeasonId:currentSeason?.id,waiversCount:waivers.length,requiredWaiversCount:requiredWaivers.length,athleteIds,loadingWaiversList,clubId,clubSlug},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('Cart waiver debug:', {
      currentSeasonId: currentSeason?.id,
      waiversCount: waivers.length,
      requiredWaiversCount: requiredWaivers.length,
      athleteIds,
      loadingWaiversList,
    })
  }, [currentSeason?.id, waivers.length, requiredWaivers.length, athleteIds.length, loadingWaiversList, clubId, clubSlug])

  // Check waiver status for athletes using direct query (can't use hooks in loops)
  const [waiverStatus, setWaiverStatus] = useState<Record<string, boolean>>({})
  const [loadingWaivers, setLoadingWaivers] = useState(true)
  
  // Store individual waiver statuses for each athlete
  const [athleteWaiverStatuses, setAthleteWaiverStatuses] = useState<Record<string, any[]>>({})
  
  // State for waiver dialog
  const [selectedWaiver, setSelectedWaiver] = useState<{ waiverId: string; athleteId: string } | null>(null)

  useEffect(() => {
    async function checkWaiverStatus() {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/cart/page.tsx:62',message:'checkWaiverStatus entry',data:{athleteIdsCount:athleteIds.length,athleteIds,currentSeasonId:currentSeason?.id,requiredWaiversCount:requiredWaivers.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (athleteIds.length === 0 || !currentSeason?.id) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/cart/page.tsx:65',message:'checkWaiverStatus early return',data:{athleteIdsCount:athleteIds.length,currentSeasonId:currentSeason?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setWaiverStatus({})
        setLoadingWaivers(false)
        return
      }

      const status: Record<string, boolean> = {}

      // Also fetch individual waiver statuses for each athlete
      const individualStatuses: Record<string, any[]> = {}
      
      for (const athleteId of athleteIds) {
        try {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/cart/page.tsx:74',message:'RPC call before',data:{athleteId,seasonId:currentSeason.id,functionName:'has_signed_required_waivers'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          // Check if athlete has signed all required waivers for current season
          const { data, error } = await supabase.rpc('has_signed_required_waivers', {
            p_athlete_id: athleteId,
            p_season_id: currentSeason.id,
          })
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/cart/page.tsx:80',message:'RPC call after',data:{athleteId,seasonId:currentSeason.id,result:data,error:error?.message||error?.code||error?.hint||JSON.stringify(error)||null,hasError:!!error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          if (error) {
            console.error('Error checking waiver status for athlete', athleteId, error)
            status[athleteId] = false
            individualStatuses[athleteId] = []
          } else {
            status[athleteId] = data === true
          }
          
          // Fetch individual waiver status for this athlete
          const { data: waiverStatusData, error: waiverStatusError } = await supabase
            .from('athlete_waiver_status')
            .select('*')
            .eq('athlete_id', athleteId)
          
          if (!waiverStatusError && waiverStatusData) {
            individualStatuses[athleteId] = waiverStatusData
          } else {
            individualStatuses[athleteId] = []
          }
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/cart/page.tsx:87',message:'RPC call exception',data:{athleteId,seasonId:currentSeason.id,error:String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          console.error('Exception checking waiver status for athlete', athleteId, err)
          status[athleteId] = false
          individualStatuses[athleteId] = []
        }
      }
      
      setAthleteWaiverStatuses(individualStatuses)

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/cart/page.tsx:91',message:'checkWaiverStatus complete',data:{status,athleteIds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setWaiverStatus(status)
      setLoadingWaivers(false)
    }

    if (athleteIds.length > 0 && currentSeason?.id) {
      setLoadingWaivers(true)
      checkWaiverStatus()
    } else {
      setWaiverStatus({})
      setLoadingWaivers(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteIds.join(','), currentSeason?.id])

  // Check if all athletes have signed required waivers
  const allWaiversSigned = athleteIds.length > 0 && requiredWaivers.length > 0
    ? athleteIds.every(id => waiverStatus[id] === true)
    : true // No waivers required or no athletes

  // Get athletes who haven't signed waivers
  const athletesNeedingWaivers = athleteIds
    .filter(id => waiverStatus[id] === false)
    .map(id => athletes.find(a => a.id === id))
    .filter(Boolean)

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
      
      // Invalidate cache to show new order and registrations
      if (household && currentSeason) {
        await queryClient.invalidateQueries({ queryKey: ['orders', household.id, currentSeason.id] })
        await queryClient.invalidateQueries({ queryKey: ['registrations', currentSeason.id] })
      }
      
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

      {/* Waiver Status - Show if waivers are loading, required waivers exist, or there are athletes in cart */}
      {(loadingWaiversList || requiredWaivers.length > 0 || athleteIds.length > 0) && (
        <Card className={
          loadingWaivers || loadingWaiversList 
            ? 'border-gray-200 bg-gray-50'
            : requiredWaivers.length === 0
            ? 'border-blue-200 bg-blue-50'
            : allWaiversSigned 
            ? 'border-green-200 bg-green-50' 
            : 'border-orange-200 bg-orange-50'
        }>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {loadingWaivers || loadingWaiversList ? (
                <>Checking waiver status...</>
              ) : requiredWaivers.length === 0 ? (
                <>
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  No Waivers Required
                </>
              ) : allWaiversSigned ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Waivers Signed
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  Waivers Required
                </>
              )}
            </CardTitle>
            <CardDescription>
              {loadingWaivers || loadingWaiversList
                ? 'Verifying waiver signatures...'
                : requiredWaivers.length === 0
                ? 'No waivers are required for this season. You can proceed to checkout.'
                : allWaiversSigned
                ? 'All athletes have signed the required waivers for this season.'
                : 'The following athletes need to sign required waivers before checkout:'
              }
            </CardDescription>
          </CardHeader>
          {!loadingWaivers && !loadingWaiversList && requiredWaivers.length > 0 && !allWaiversSigned && athletesNeedingWaivers.length > 0 && (
            <CardContent>
              <div className="space-y-4">
                {athletesNeedingWaivers.map((athlete) => {
                  if (!athlete) return null
                  
                  // Get waiver status for this athlete
                  const athleteWaiverStatus = waiverStatus[athlete.id]
                  const needsWaivers = athleteWaiverStatus === false

                  return (
                    <div key={athlete.id} className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-300">
                        <div>
                          <span className="font-medium text-sm">{athlete.first_name} {athlete.last_name}</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            Missing {requiredWaivers.length} required waiver(s)
                          </p>
                        </div>
                        <Link href={`/clubs/${clubSlug}/parent/athletes/${athlete.id}?returnTo=cart`}>
                          <Button
                            size="sm"
                            variant="outline"
                          >
                            View Details
                          </Button>
                        </Link>
                      </div>
                      
                      {/* Show waiver list for this athlete */}
                      {needsWaivers && (
                        <AthleteWaiverList
                          athlete={athlete}
                          requiredWaivers={requiredWaivers}
                          onSignWaiver={(waiverId) => setSelectedWaiver({ waiverId, athleteId: athlete.id })}
                          athleteWaiverStatus={athleteWaiverStatuses[athlete.id] || []}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

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
            disabled={processing || !currentSeason || !allWaiversSigned}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {processing ? 'Processing...' : 'Proceed to Checkout'}
          </Button>
          {!allWaiversSigned && requiredWaivers.length > 0 && (
            <p className="text-sm text-orange-600 font-medium mt-2 text-center">
              ⚠️ All required waivers must be signed before checkout. Click "Sign Waivers" above.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Waiver Sign Dialog */}
      {selectedWaiver && athletes && waivers.length > 0 && profile && (
        (() => {
          const athlete = athletes.find(a => a.id === selectedWaiver.athleteId)
          const waiver = waivers.find((w: any) => w.id === selectedWaiver.waiverId)
          
          if (!athlete || !waiver) return null
          
          return (
            <WaiverSignDialog
              open={!!selectedWaiver}
              onOpenChange={(open) => !open && setSelectedWaiver(null)}
              waiver={waiver}
              athlete={athlete}
              guardianId={profile.id}
              onSignatureComplete={() => {
                setSelectedWaiver(null)
                // Trigger waiver status refetch by updating the dependency
                // The useEffect that checks waiver status will run again
                if (athleteIds.length > 0 && currentSeason?.id) {
                  // Force a refetch by toggling loading state
                  setLoadingWaivers(true)
                  // The useEffect will automatically refetch due to dependency on athleteIds.join(',')
                  // Small delay to allow query invalidation to complete
                  setTimeout(() => {
                    setLoadingWaivers(false)
                  }, 1000)
                }
              }}
            />
          )
        })()
      )}
    </div>
  )
}
