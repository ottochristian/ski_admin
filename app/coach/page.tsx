'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Calendar, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin-page-header'

type Profile = {
  id: string
  email: string
  first_name?: string | null
  role: string
}

type Coach = {
  id: string
  profile_id: string
  // add other coach fields if you have them
}

type CoachAssignment = {
  id: string
  role?: string | null
  programs?: { name?: string | null } | null
  sub_programs?: { name?: string | null } | null
  groups?: { name?: string | null } | null
}

const getRoleLabel = (role?: string | null): string => {
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
  // Format: "Head Coach Prep Team" or "Assistant Coach Alpine Program"
  return role ? `${role} ${name}` : name
}

export default function CoachDashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())


  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [coach, setCoach] = useState<Coach | null>(null)
  const [assignments, setAssignments] = useState<CoachAssignment[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // 1) Ensure user is logged in
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      // 2) Fetch profile and ensure coach role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      if (!profileData || profileData.role !== 'coach') {
        router.push('/login')
        return
      }

      setProfile(profileData as Profile)

      // 3) Fetch coach row
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      if (coachError) {
        // not fatal: we can still show "no assignments" state
        console.log('[coach] coachError', coachError)
      }

      setCoach((coachData || null) as Coach | null)

      // 4) Fetch assignments if we have a coach id
      if (coachData?.id) {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('coach_assignments')
          .select(
            `
            id,
            role,
            programs ( name ),
            sub_programs ( name ),
            groups ( name )
          `
          )
          .eq('coach_id', coachData.id)

        if (assignmentsError) {
          setError(assignmentsError.message)
        } else {
          setAssignments((assignmentsData || []) as CoachAssignment[])
        }
      }

      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">Loading coach dashboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/coach">
            <Button>Back to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (!profile) {
    // Shouldn't happen with the checks above, but bail safely.
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Coach Dashboard"
        description={`Welcome, ${profile.first_name || profile.email}`}
      />

      <div>
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/coach/athletes">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Users className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">View Athletes</CardTitle>
                  <CardDescription>See your assigned athletes</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/coach/races">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Calendar className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">Manage Races</CardTitle>
                  <CardDescription>
                    Register athletes for races
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/coach/messages">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <MessageSquare className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">Send Messages</CardTitle>
                  <CardDescription>
                    Communicate with families
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* Assignments */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Your Assignments
          </h2>
          {assignments && assignments.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {assignments.map(assignment => {
                const displayName = getAssignmentDisplayName(assignment)
                return (
                  <Card key={assignment.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {displayName}
                      </CardTitle>
                      {assignment.role && (
                        <CardDescription>
                          Role: {getRoleLabel(assignment.role)}
                        </CardDescription>
                      )}
                    </CardHeader>
                  <CardContent>
                    <Link href={`/coach/assignments/${assignment.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        View Details
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Assignments Yet</CardTitle>
                <CardDescription>
                  You haven&apos;t been assigned to any programs yet. Please
                  contact an administrator.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
