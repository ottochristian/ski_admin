'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useParentClub } from '@/lib/use-parent-club'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function ParentAthletesPage() {
  const params = useParams()
  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const { athletes, loading, error } = useParentClub()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading athletes…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Athletes</h1>
          <p className="text-muted-foreground">
            Manage athletes in your household
          </p>
        </div>
        <Button onClick={() => router.push(`/clubs/${clubSlug}/parent/athletes/new`)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Athlete
        </Button>
      </div>

      {athletes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                No athletes in your household yet.
              </p>
              <Button onClick={() => router.push(`/clubs/${clubSlug}/parent/athletes/new`)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Athlete
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Athletes</CardTitle>
            <CardDescription>
              {athletes.length} athlete{athletes.length !== 1 ? 's' : ''} in your household
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {athletes.map(athlete => (
                <div
                  key={athlete.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <h3 className="font-semibold">
                      {athlete.first_name} {athlete.last_name}
                    </h3>
                    {athlete.date_of_birth && (
                      <p className="text-sm text-muted-foreground">
                        DOB: {new Date(athlete.date_of_birth).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Link href={`/clubs/${clubSlug}/parent/athletes/${athlete.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
