'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useAdminClub } from '@/lib/use-admin-club'
import { clubQuery } from '@/lib/supabase-helpers'

interface Coach {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  specialization?: string
}

export default function CoachesPage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCoaches() {
      if (authLoading || !clubId) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      try {
        const { data, error: coachesError } = await clubQuery(
          supabase
            .from('coaches')
            .select('*')
            .order('first_name', { ascending: true }),
          clubId
        )

        if (coachesError) {
          setError(coachesError.message)
        } else {
          setCoaches(data || [])
        }
      } catch (err) {
        console.error('Error loading coaches:', err)
        setError('Failed to load coaches')
      } finally {
        setLoading(false)
      }
    }

    loadCoaches()
  }, [router, clubId, authLoading, authError])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading coaches…</p>
      </div>
    )
  }

  if (error || authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coaches</h1>
          <p className="text-muted-foreground">Manage all coaching staff</p>
        </div>
        <Link href="/admin/coaches/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Coach
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Coaches</CardTitle>
          <CardDescription>Complete list of coaches in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {coaches.length > 0 ? (
            <div className="space-y-4">
              {coaches.map((coach) => (
                <div
                  key={coach.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {coach.first_name} {coach.last_name}
                    </p>
                    {coach.email && (
                      <p className="text-sm text-muted-foreground">{coach.email}</p>
                    )}
                    {coach.specialization && (
                      <p className="text-sm text-muted-foreground">
                        {coach.specialization}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No coaches found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
