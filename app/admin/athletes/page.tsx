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
import { AdminPageHeader } from '@/components/admin-page-header'

interface Athlete {
  id: string
  first_name?: string
  last_name?: string
  date_of_birth?: string
  parent_id?: string
}

export default function AthletesPage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAthletes() {
      if (authLoading || !clubId) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      try {
        const { data, error: athletesError } = await clubQuery(
          supabase
            .from('athletes')
            .select('*')
            .order('first_name', { ascending: true }),
          clubId
        )

        if (athletesError) {
          setError(athletesError.message)
        } else {
          setAthletes(data || [])
        }
      } catch (err) {
        console.error('Error loading athletes:', err)
        setError('Failed to load athletes')
      } finally {
        setLoading(false)
      }
    }

    loadAthletes()
  }, [router, clubId, authLoading, authError])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading athletes…</p>
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
        <AdminPageHeader
          title="Athletes"
          description="Manage all registered athletes"
        />
        <Link href="/admin/athletes/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Athlete
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Athletes</CardTitle>
          <CardDescription>
            Complete list of athletes in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {athletes.length > 0 ? (
            <div className="space-y-4">
              {athletes.map((athlete) => (
                <div
                  key={athlete.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {athlete.first_name} {athlete.last_name}
                    </p>
                    {athlete.date_of_birth && (
                      <p className="text-sm text-muted-foreground">
                        DOB: {new Date(athlete.date_of_birth).toLocaleDateString()}
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
              No athletes found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
