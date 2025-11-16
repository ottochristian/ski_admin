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
import { Users, DollarSign, Calendar, Settings } from 'lucide-react'
import Link from 'next/link'
import { LogoutButton } from '@/components/logout-button'

type Profile = {
  id: string
  email: string
  first_name?: string | null
  role: string
}

type RecentRegistration = {
  id: string
  status: string
  created_at: string
  athletes?: {
    first_name?: string
    last_name?: string
    families?: {
      family_name?: string
    } | null
  } | null
  sub_programs?: {
    name?: string
    programs?: {
      name?: string
    } | null
  } | null
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [totalAthletes, setTotalAthletes] = useState<number>(0)
  const [totalRegistrations, setTotalRegistrations] = useState<number>(0)
  const [totalPrograms, setTotalPrograms] = useState<number>(0)
  const [recentRegistrations, setRecentRegistrations] = useState<
    RecentRegistration[]
  >([])

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

      // 2) Fetch profile and ensure admin
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

      if (!profileData || profileData.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setProfile(profileData as Profile)

      // 3) Fetch counts
      const [{ count: athletesCount }, { count: registrationsCount }, { count: programsCount }] =
        await Promise.all([
          supabase
            .from('athletes')
            .select('*', { count: 'exact', head: true }),
          supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true }),
          supabase
            .from('programs')
            .select('*', { count: 'exact', head: true }),
        ])

      setTotalAthletes(athletesCount || 0)
      setTotalRegistrations(registrationsCount || 0)
      setTotalPrograms(programsCount || 0)

      // 4) Recent registrations
      const { data: recent, error: recentError } = await supabase
        .from('registrations')
        .select(
          `
          id,
          status,
          created_at,
          athletes (
            first_name,
            last_name,
            families ( family_name )
          ),
          sub_programs (
            name,
            programs ( name )
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentError) {
        setError(recentError.message)
      } else {
        setRecentRegistrations((recent || []) as RecentRegistration[])
      }

      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 text-sm">Loading admin dashboard…</p>
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
    // Shouldn't really happen with the checks above, but just in case
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Admin Dashboard
              </h1>
              <p className="text-sm text-slate-600">
                Welcome, {profile.first_name || profile.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/settings">
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <LogoutButton />
            </div>
          </div>

          {/* Quick Nav */}
          <nav className="flex gap-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link href="/admin/programs">
              <Button variant="ghost" size="sm">
                Programs
              </Button>
            </Link>
            <Link href="/admin/registrations">
              <Button variant="ghost" size="sm">
                Registrations
              </Button>
            </Link>
            <Link href="/admin/athletes">
              <Button variant="ghost" size="sm">
                Athletes
              </Button>
            </Link>
            <Link href="/admin/coaches">
              <Button variant="ghost" size="sm">
                Coaches
              </Button>
            </Link>
            <Link href="/admin/races">
              <Button variant="ghost" size="sm">
                Races
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Athletes</CardDescription>
              <CardTitle className="text-3xl">{totalAthletes}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Registrations</CardDescription>
              <CardTitle className="text-3xl">
                {totalRegistrations}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Programs</CardDescription>
              <CardTitle className="text-3xl">{totalPrograms}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-3xl">$0</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/programs/new">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Users className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">Create Program</CardTitle>
                  <CardDescription>Add a new ski program</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/registrations">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <DollarSign className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">
                    View Registrations
                  </CardTitle>
                  <CardDescription>Manage all registrations</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/races/new">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Calendar className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">Add Race</CardTitle>
                  <CardDescription>Create a new race event</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/coaches">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Users className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">Manage Coaches</CardTitle>
                  <CardDescription>View and assign coaches</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* Recent Registrations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Registrations
            </h2>
            <Link href="/admin/registrations">
              <Button variant="outline">View All</Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentRegistrations.length > 0 ? (
                  recentRegistrations.map(reg => (
                    <div
                      key={reg.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {reg.athletes?.first_name}{' '}
                          {reg.athletes?.last_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {reg.athletes?.families?.family_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {reg.sub_programs?.programs?.name} -{' '}
                          {reg.sub_programs?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">
                          {reg.status}
                        </p>
                        <p className="text-sm text-slate-600">
                          {new Date(reg.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-600">
                    No registrations yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
