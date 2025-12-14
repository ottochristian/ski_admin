'use client'

import { useSearchParams } from 'next/navigation'
import { useParentClub } from '@/lib/use-parent-club'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { useOrdersByHousehold } from '@/lib/hooks/use-orders'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

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
  const searchParams = useSearchParams()
  const { clubId, household, loading: authLoading } = useParentClub()

  // PHASE 2: Use base useSeason hook - RLS handles filtering
  const currentSeason = useCurrentSeason()

  // PHASE 2: RLS handles club filtering automatically
  const {
    data: orders = [],
    isLoading: ordersLoading,
    error: ordersError,
    refetch,
  } = useOrdersByHousehold(household?.id || null, currentSeason?.id)

  const isLoading = authLoading || ordersLoading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading billing history…" />
  }

  // Show error state
  if (ordersError) {
    return <ErrorState error={ordersError} onRetry={() => refetch()} />
  }

  // Show message if no household or season
  if (!household || !currentSeason) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>
              Please set up your household and select a season to view billing
              history.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const success = searchParams.get('success')

  // Filter and group orders
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const paidOrders = orders.filter(
    (order: Order) =>
      order.status === 'paid' || order.status === 'partially_paid'
  )

  const recentUnpaidOrders = orders.filter((order: Order) => {
    if (order.status === 'paid' || order.status === 'partially_paid') {
      return false
    }

    const orderDate = new Date(order.created_at)
    const hasSuccessfulPayment = order.payments.some(
      (p) => p.status === 'succeeded'
    )

    return orderDate > oneHourAgo || hasSuccessfulPayment
  })

  function renderOrder(order: Order) {
    const totalPaid = order.payments
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const isPaid = order.status === 'paid'
    const isPartial = order.status === 'partially_paid'

    return (
      <Card key={order.id}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Order #{order.id.slice(0, 8)}
              </CardTitle>
              <CardDescription>
                {new Date(order.created_at).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isPaid && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  <CheckCircle2 className="h-3 w-3" />
                  Paid
                </span>
              )}
              {isPartial && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                  <Clock className="h-3 w-3" />
                  Partial
                </span>
              )}
              {!isPaid && !isPartial && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                  <XCircle className="h-3 w-3" />
                  Unpaid
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.order_items.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Items</h4>
                <div className="space-y-2">
                  {order.order_items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm border-b pb-2"
                    >
                      <span>{item.description}</span>
                      <span>${Number(item.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Total Amount</span>
                <span className="font-semibold">
                  ${Number(order.total_amount).toFixed(2)}
                </span>
              </div>
              {order.payments.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Amount Paid</span>
                  <span className="font-semibold">
                    ${totalPaid.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {order.payments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Payments</h4>
                <div className="space-y-2">
                  {order.payments.map((payment, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-xs border rounded p-2"
                    >
                      <div>
                        <span className="capitalize">{payment.method}</span>
                        {payment.processed_at && (
                          <span className="text-muted-foreground ml-2">
                            {new Date(payment.processed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>${Number(payment.amount).toFixed(2)}</span>
                        {payment.status === 'succeeded' && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            Paid
                          </span>
                        )}
                        {payment.status === 'pending' && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                            Pending
                          </span>
                        )}
                        {payment.status === 'failed' && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">View your order and payment history</p>
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

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground">
                No orders found for this season.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {paidOrders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Paid Orders</h2>
              <div className="space-y-4">
                {paidOrders.map((order: Order) => renderOrder(order))}
              </div>
            </div>
          )}

          {recentUnpaidOrders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
              <div className="space-y-4">
                {recentUnpaidOrders.map((order: Order) => renderOrder(order))}
              </div>
            </div>
          )}

          {paidOrders.length === 0 && recentUnpaidOrders.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-muted-foreground">
                    No active orders. Old unpaid orders are hidden to reduce
                    clutter.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
