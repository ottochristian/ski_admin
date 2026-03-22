'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function CheckoutCompletePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const orderId = searchParams.get('order')

  const [status, setStatus] = useState<'loading' | 'paid' | 'pending' | 'error'>('loading')

  useEffect(() => {
    if (!orderId) {
      setStatus('error')
      return
    }

    const supabase = createClient()

    // Poll order status — webhook may take a second or two
    let attempts = 0
    const maxAttempts = 10

    const check = async () => {
      const { data: order } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single()

      if (order?.status === 'paid') {
        setStatus('paid')
        setTimeout(() => router.push(`/clubs/${clubSlug}/parent/dashboard`), 3000)
        return
      }

      attempts++
      if (attempts >= maxAttempts) {
        setStatus('pending')
        setTimeout(() => router.push(`/clubs/${clubSlug}/parent/dashboard`), 4000)
        return
      }

      setTimeout(check, 1500)
    }

    check()
  }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
          <div>
            <h1 className="text-xl font-semibold">Confirming your payment…</h1>
            <p className="text-sm text-muted-foreground mt-1">Just a moment</p>
          </div>
        </>
      )}

      {status === 'paid' && (
        <>
          <CheckCircle className="h-14 w-14 text-green-500" />
          <div>
            <h1 className="text-xl font-semibold">Registration confirmed!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Payment received. Redirecting you to your dashboard…
            </p>
          </div>
          <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
        </>
      )}

      {status === 'pending' && (
        <>
          <CheckCircle className="h-14 w-14 text-green-500" />
          <div>
            <h1 className="text-xl font-semibold">Payment received!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your registration is being confirmed — this usually takes a few seconds.
              Check your dashboard for the updated status.
            </p>
          </div>
          <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle className="h-12 w-12 text-destructive" />
          <div>
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mt-1">
              We could not verify your order. If payment was completed, your registration
              will be confirmed shortly.
            </p>
          </div>
          <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </>
      )}
    </div>
  )
}
