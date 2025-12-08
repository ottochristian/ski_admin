'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useParentClub } from '@/lib/use-parent-club'
// Removed useAdminSeason - it requires admin role and causes redirects for parent users
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
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

type Order = {
  id: string
  total_amount: number
  status: string
  created_at: string
  order_items: Array<{
    description: string
    amount: number
  }>
  payments: Array<{
    amount: number
    status: string
    method: string
    processed_at: string
  }>
}

export default function BillingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const clubSlug = params.clubSlug as string
  const { clubId, household, loading: authLoading } = useParentClub()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedSeason, setSelectedSeason] = useState<{ id: string; name: string } | null>(null)

  // Load current season for the club
  useEffect(() => {
    async function loadSeason() {
      if (authLoading || !clubId) {
        return
      }

      try {
        const { data: seasonData, error: seasonError } = await supabase
          .from('seasons')
          .select('id, name')
          .eq('club_id', clubId)
          .eq('is_current', true)
          .single()

        if (seasonError || !seasonData) {
          setError('No current season found. Please contact support.')
          setLoading(false)
          return
        }

        setSelectedSeason(seasonData)
      } catch (err) {
        console.error('Error loading season:', err)
        setError('Failed to load season information')
        setLoading(false)
      }
    }

    loadSeason()
  }, [clubId, authLoading])

  // Load orders once we have season and household
  useEffect(() => {
    async function loadOrders() {
      if (!clubId || !household || !selectedSeason) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const { data, error: ordersError } = await clubQuery(
          supabase
            .from('orders')
            .select(`
              id,
              total_amount,
              status,
              created_at,
              order_items (
                description,
                amount
              ),
              payments (
                amount,
                status,
                method,
                processed_at
              )
            `)
            .eq('household_id', household.id)
            .eq('season_id', selectedSeason.id)
            .order('created_at', { ascending: false }),
          clubId
        )

        if (ordersError) {
          setError(ordersError.message)
        } else {
          setOrders((data || []) as Order[])
        }
      } catch (err) {
        console.error('Error loading orders:', err)
        setError('Failed to load orders')
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [clubId, household, selectedSeason])

  const success = searchParams.get('success')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading billing history…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          View your order and payment history
        </p>
      </div>

      {success === 'true' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">
              Payment successful! Your registrations have been confirmed.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground">No orders found for this season.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const totalPaid = order.payments
              .filter(p => p.status === 'succeeded')
              .reduce((sum, p) => sum + Number(p.amount), 0)

            const isPaid = order.status === 'paid'
            const isPartial = order.status === 'partially_paid'

            return (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                      <CardDescription>
                        {new Date(order.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Paid
                        </span>
                      ) : isPartial ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                          <Clock className="h-3 w-3" />
                          Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                          <XCircle className="h-3 w-3" />
                          Unpaid
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Items</h4>
                      <div className="space-y-2">
                        {order.order_items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {item.description}
                            </span>
                            <span className="font-medium">
                              ${Number(item.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-semibold">
                          ${Number(order.total_amount).toFixed(2)}
                        </span>
                      </div>
                      {totalPaid > 0 && (
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-muted-foreground">Paid</span>
                          <span className="font-medium text-green-600">
                            ${totalPaid.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    {order.payments.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Payments</h4>
                        <div className="space-y-1">
                          {order.payments.map((payment, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-xs text-muted-foreground"
                            >
                              <span>
                                {payment.method} - {payment.status}
                              </span>
                              <span>
                                ${Number(payment.amount).toFixed(2)} -{' '}
                                {payment.processed_at
                                  ? new Date(payment.processed_at).toLocaleDateString()
                                  : 'Pending'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
