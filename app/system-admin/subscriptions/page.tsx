'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystemAdmin } from '@/lib/use-system-admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Check, X } from 'lucide-react'

// Placeholder for subscription tiers - you'll need to create a subscriptions table
type SubscriptionTier = {
  id: string
  name: string
  features: string[]
}

type ClubSubscription = {
  club_id: string
  club_name: string
  tier: string
  features: string[]
}

const TIERS: SubscriptionTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    features: ['Program Management', 'Athlete Registration', 'Basic Reporting'],
  },
  {
    id: 'pro',
    name: 'Pro',
    features: [
      'Program Management',
      'Athlete Registration',
      'Advanced Reporting',
      'Custom Branding',
      'API Access',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    features: [
      'Program Management',
      'Athlete Registration',
      'Advanced Reporting',
      'Custom Branding',
      'API Access',
      'Multi-Season Management',
      'Priority Support',
    ],
  },
]

export default function SubscriptionsPage() {
  const { profile, loading: authLoading } = useSystemAdmin()
  const [loading, setLoading] = useState(true)
  const [clubSubscriptions, setClubSubscriptions] = useState<ClubSubscription[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSubscriptions() {
      if (authLoading) return

      try {
        setLoading(true)
        setError(null)

        // Load all clubs
        const { data: clubsData, error: clubsError } = await supabase
          .from('clubs')
          .select('id, name')
          .order('name', { ascending: true })

        if (clubsError) {
          setError(clubsError.message)
          setLoading(false)
          return
        }

        // For now, assign default tier (you'll need to create a subscriptions table)
        const subscriptions: ClubSubscription[] = (clubsData || []).map((club) => ({
          club_id: club.id,
          club_name: club.name,
          tier: 'basic', // Default tier
          features: TIERS.find((t) => t.id === 'basic')?.features || [],
        }))

        setClubSubscriptions(subscriptions)
      } catch (err) {
        console.error('Error loading subscriptions:', err)
        setError('Failed to load subscriptions')
      } finally {
        setLoading(false)
      }
    }

    loadSubscriptions()
  }, [authLoading])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading subscriptions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Subscriptions</h2>
        <p className="text-muted-foreground">Manage subscription tiers and feature flags</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((tier) => (
          <Card key={tier.id}>
            <CardHeader>
              <CardTitle>{tier.name}</CardTitle>
              <CardDescription>
                {clubSubscriptions.filter((s) => s.tier === tier.id).length} clubs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Club Subscriptions</CardTitle>
          <CardDescription>Manage tier and features for each club</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {clubSubscriptions.map((subscription) => (
              <div
                key={subscription.club_id}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div>
                  <div className="font-medium">{subscription.club_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {subscription.features.length} features enabled
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{subscription.tier}</Badge>
                  <Button variant="outline" size="sm">
                    Manage
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Subscription management requires a <code>subscriptions</code> table to track tier
            assignments and feature flags per club. This is a placeholder implementation.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
