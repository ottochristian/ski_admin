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
import { useCoaches } from '@/lib/hooks/use-coaches'
import { AdminPageHeader } from '@/components/admin-page-header'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

interface CoachAssignment {
  id: string
  program_id?: string
  sub_program_id?: string
  group_id?: string
  role?: string
  programs?: { name?: string }
  sub_programs?: { name?: string }
  groups?: { name?: string }
}

const getRoleLabel = (role?: string): string => {
  switch (role) {
    case 'head_coach':
      return 'Head Coach'
    case 'assistant_coach':
      return 'Assistant Coach'
    case 'substitute_coach':
      return 'Substitute Coach'
    default:
      return 'Coach'
  }
}

const getAssignmentDisplayName = (assignment: CoachAssignment): string => {
  const name = assignment.groups?.name || assignment.sub_programs?.name || assignment.programs?.name || 'Unknown'
  const role = assignment.role ? getRoleLabel(assignment.role) : ''
  return role ? `${role} ${name}` : name
}

export default function CoachesPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, loading: authLoading } = useRequireAdmin()
  const basePath = `/clubs/${clubSlug}/admin`

  // PHASE 2: RLS handles club filtering automatically - no clubQuery needed!
  // Include assignments in the query
  const {
    data: coaches = [],
    isLoading,
    error,
    refetch,
  } = useCoaches(true) // Include assignments

  // Transform data to match expected format
  const coachesWithAssignments = coaches.map((coach: any) => ({
    ...coach,
    assignments: coach.coach_assignments || [],
  }))

  // Show loading state
  if (authLoading || isLoading) {
    return <InlineLoading message="Loading coaches…" />
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
          title="Coaches"
          description="Manage all coaching staff"
        />
        <Link href={`${basePath}/coaches/new`}>
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
          {coachesWithAssignments.length > 0 ? (
            <div className="space-y-4">
              {coachesWithAssignments.map((coach) => {
                const assignments = coach.assignments || []
                return (
                  <div
                    key={coach.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div className="flex-1">
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
                      {assignments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {assignments.slice(0, 3).map((assignment: CoachAssignment) => {
                            const displayName = getAssignmentDisplayName(assignment)
                            const isHeadCoach = assignment.role === 'head_coach'
                            const isSubstitute = assignment.role === 'substitute_coach'
                            const bgColor = isHeadCoach 
                              ? 'bg-green-100 text-green-800'
                              : isSubstitute
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                            return (
                              <span
                                key={assignment.id}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bgColor}`}
                              >
                                {displayName}
                              </span>
                            )
                          })}
                          {assignments.length > 3 && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                              +{assignments.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                      {assignments.length === 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">No assignments</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`${basePath}/coaches/${coach.id}/assign`}>
                          {assignments.length > 0 ? 'Edit Assignments' : 'Assign'}
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
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


