'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useRequireAdmin } from '@/lib/auth-context'
import { useAthletes } from '@/lib/hooks/use-athletes'
import { AdminPageHeader } from '@/components/admin-page-header'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

interface Athlete {
  id: string
  first_name?: string
  last_name?: string
  date_of_birth?: string
  parent_id?: string
}

export default function AthletesPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, loading: authLoading } = useRequireAdmin()
  const basePath = `/clubs/${clubSlug}/admin`

  // PHASE 2: RLS handles club filtering automatically - no clubQuery needed!
  const {
    data: athletes = [],
    isLoading,
    error,
    refetch,
  } = useAthletes()

  // Show loading state
  if (authLoading || isLoading) {
    return <InlineLoading message="Loading athletes…" />
  }

  // Show error state
  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />
  }

  // Auth check ensures profile exists
  if (!profile) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Athletes"
          description="Manage all registered athletes"
        />
        <Link href={`${basePath}/athletes/new`}>
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


