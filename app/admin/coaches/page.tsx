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

interface Coach {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  specialization?: string
}

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
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [assignmentsMap, setAssignmentsMap] = useState<Map<string, CoachAssignment[]>>(new Map())
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
          
          // Load assignments for all coaches
          if (data && data.length > 0) {
            const coachIds = data.map((c: Coach) => c.id)
            const { data: assignmentsData, error: assignmentsError } = await clubQuery(
              supabase
                .from('coach_assignments')
                .select(`
                  id,
                  coach_id,
                  program_id,
                  sub_program_id,
                  group_id,
                  role,
                  programs (name),
                  sub_programs (name),
                  groups (name)
                `)
                .in('coach_id', coachIds),
              clubId
            )

            if (assignmentsError) {
              console.error('Error loading coach assignments:', {
                error: assignmentsError,
                message: assignmentsError.message,
                details: assignmentsError.details,
                hint: assignmentsError.hint,
              })
              // Don't block the UI - just show coaches without assignments
              setAssignmentsMap(new Map())
            } else {
              // Group assignments by coach_id
              const assignmentsByCoach = new Map<string, CoachAssignment[]>()
              assignmentsData?.forEach((assignment: CoachAssignment & { coach_id: string }) => {
                const existing = assignmentsByCoach.get(assignment.coach_id) || []
                assignmentsByCoach.set(assignment.coach_id, [...existing, assignment])
              })
              setAssignmentsMap(assignmentsByCoach)
            }
          }
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
        <AdminPageHeader
          title="Coaches"
          description="Manage all coaching staff"
        />
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
              {coaches.map((coach) => {
                const assignments = assignmentsMap.get(coach.id) || []
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
                          {assignments.slice(0, 3).map((assignment) => {
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
                        <Link href={`/admin/coaches/${coach.id}/assign`}>
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
