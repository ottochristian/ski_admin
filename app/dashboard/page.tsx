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
import { Users, UserPlus, Trophy, Settings } from 'lucide-react'
import Link from 'next/link'
import { LogoutButton } from '@/components/logout-button'

type Profile = {
  id: string
  email: string
  first_name?: string | null
  role: string
}

type Family = {
  id: string
  profile_id: string
}

type Registration = {
  id: string
}

type Athlete = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  ussa_number?: string | null
  registrations?: Registration[]
}

export default function DashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)

      // 1) Get user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      console.log('[dashboard] getUser result', { user, userError })

      if (userError || !user) {
        // no logged-in user -> go to /login
        router.push('/login')
        return
      }

      // 2) Get profile
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id) // id column matches auth.users.id
        .single()

      console.log('[dashboard] profile fetch', { profileData, profileError })

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      if (!profileData) {
        // we’ll hit the “Profile Setup Required” UI below
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(profileData as Profile)

      // 3) Route based on role
      if (profileData.role === 'admin') {
        router.push('/admin')
        return
      }

      if (profileData.role === 'coach') {
        router.push('/coach')
        return
      }

      // 4) Get family
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      console.log('[dashboard] family fetch', { familyData, familyError })

      setFamily((familyData || null) as Family | null)

      // 5) Get athletes
      if (familyData?.id) {
        const { data: athletesData, error: athletesError } = await supabase
          .from('athletes')
          .select('*, registrations(*)')
          .eq('family_id', familyData.id)

        console.log('[dashboard] athletes fetch', {
          athletesData,
          athletesError,
        })

        if (athletesError) {
          setError(athletesError.message)
        } else {
          setAthletes((athletesData || []) as Athlete[])
        }
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const activeRegistrations =
    athletes?.reduce((acc, athlete) => {
      return acc + (athlete.registrations?.length || 0)
    }, 0) || 0

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground">Loading your dashboard…</p>
      </div>
    )
  }

  // Generic error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No profile row found
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Profile Setup Required</CardTitle>
            <CardDescription>
              Your account was created but your profile needs to be set up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              It looks like the database tables haven&apos;t been created yet. Please
              make sure to run the SQL scripts in the scripts folder:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>001_create_base_tables.sql</li>
              <li>002_enable_rls.sql</li>
              <li>003_create_triggers.sql</li>
              <li>004_seed_sample_data.sql</li>
            </ol>
            <p className="text-sm text-muted-foreground">
              After running these scripts, refresh this page or log out and log back in.
            </p>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/">Go Home</Link>
              </Button>
              <LogoutButton />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Normal dashboard UI
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Family Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {profile.first_name || profile.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/settings">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Athletes</CardDescription>
              <CardTitle className="text-3xl">{athletes?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/athletes">
                <Button variant="link" className="px-0">
                  View All
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Registrations</CardDescription>
              <CardTitle className="text-3xl">{activeRegistrations}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/registrations">
                <Button variant="link" className="px-0">
                  View All
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Messages</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/messages">
                <Button variant="link" className="px-0">
                  View All
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href={family ? '/dashboard/athletes/new' : '/dashboard/family-setup'}
            >
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <UserPlus className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">Add Athlete</CardTitle>
                  <CardDescription>Register a new athlete</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/dashboard/programs">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Users className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">Browse Programs</CardTitle>
                  <CardDescription>View available programs</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/dashboard/races">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Trophy className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">View Races</CardTitle>
                  <CardDescription>Check upcoming races</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/dashboard/settings">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Settings className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">Account Settings</CardTitle>
                  <CardDescription>Update your information</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* Setup prompt if no family */}
        {!family && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
              <CardDescription>
                Please complete your family information to start registering athletes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/family-setup">
                <Button>Complete Profile</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Athletes List */}
        {athletes && athletes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Your Athletes
              </h2>
              <Link href="/dashboard/athletes/new">
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Athlete
                </Button>
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {athletes.map(athlete => (
                <Card key={athlete.id}>
                  <CardHeader>
                    <CardTitle>
                      {athlete.first_name} {athlete.last_name}
                    </CardTitle>
                    <CardDescription>
                      {athlete.date_of_birth &&
                        new Date(athlete.date_of_birth).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {athlete.ussa_number && (
                      <p className="text-sm text-muted-foreground">
                        USSA: {athlete.ussa_number}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {athlete.registrations?.length || 0} active registrations
                    </p>
                    <Link href={`/dashboard/athletes/${athlete.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
