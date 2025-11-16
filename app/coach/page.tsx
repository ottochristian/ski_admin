'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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
import { LogoutButton } from '@/components/logout-button'

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
  programs?: { name?: string | null } | null
  sub_programs?: { name?: string | null } | null
  groups?: { name?: string | null } | null
}

export default function CoachDashboardPage() {
  const router = useRouter()

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
        router.push('/dashboard')
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 text-sm">Loading coach dashboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    // Shouldn't happen with the checks above, but bail safely.
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Coach Dashboard
              </h1>
              <p className="text-sm text-slate-600">
                Welcome, {profile.first_name || profile.email}
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
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
              {assignments.map(assignment => (
                <Card key={assignment.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {assignment.programs?.name}
                    </CardTitle>
                    <CardDescription>
                      {assignment.sub_programs?.name}
                      {assignment.groups?.name &&
                        ` - ${assignment.groups.name}`}
                    </CardDescription>
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
              ))}
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
