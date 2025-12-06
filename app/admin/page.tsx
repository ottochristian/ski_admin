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
import {
  Users,
  BookOpen,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react'
import { Profile } from '@/lib/types'
import { useAdminClub } from '@/lib/use-admin-club'
import { useAdminSeason } from '@/lib/use-admin-season'
import { clubQuery } from '@/lib/supabase-helpers'

interface DashboardStats {
  totalAthletes: number
  activePrograms: number
  totalRegistrations: number
  totalRevenue: number
  recentRegistrations: Array<{
    id: string
    status: string
    athlete?: { first_name?: string; last_name?: string }
    program?: { name: string }
  }>
}

export default function AdminDashboard() {
  const router = useRouter()
  const { clubId, profile, loading: authLoading, error: authError } = useAdminClub()
  const { selectedSeason, loading: seasonLoading } = useAdminSeason()
  const [stats, setStats] = useState<DashboardStats>({
    totalAthletes: 0,
    activePrograms: 0,
    totalRegistrations: 0,
    totalRevenue: 0,
    recentRegistrations: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboardStats() {
      if (authLoading || seasonLoading || !clubId || !selectedSeason) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      try {
        // Load all stats in parallel with club and season filtering
        const [
          { count: athletesCount },
          { count: programsCount },
          { count: registrationsCount },
          { data: registrationsData },
          { data: paymentData },
        ] = await Promise.all([
          clubQuery(
            supabase.from('athletes').select('*', { count: 'exact', head: true }),
            clubId
          ),
          clubQuery(
            supabase
              .from('programs')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'ACTIVE')
              .eq('season_id', selectedSeason.id),
            clubId
          ),
          clubQuery(
            supabase
              .from('registrations')
              .select('*', { count: 'exact', head: true })
              .eq('season_id', selectedSeason.id),
            clubId
          ),
          clubQuery(
            supabase
              .from('registrations')
              .select(
                `
              id,
              status,
              athletes(first_name, last_name),
              sub_programs(name, programs(name))
            `
              )
              .eq('season_id', selectedSeason.id)
              .order('created_at', { ascending: false })
              .limit(5),
            clubId
          ),
          clubQuery(
            supabase
              .from('registrations')
              .select('amount_paid')
              .eq('season_id', selectedSeason.id),
            clubId
          ),
        ])

        const totalRevenue =
          paymentData?.reduce((sum, reg) => sum + Number(reg.amount_paid || 0), 0) || 0

        const recentRegs = (registrationsData || []).map((reg: any) => ({
          ...reg,
          athlete: reg.athletes,
          program: reg.sub_programs?.programs || { name: reg.sub_programs?.name || 'Unknown' },
        }))

        setStats({
          totalAthletes: athletesCount || 0,
          activePrograms: programsCount || 0,
          totalRegistrations: registrationsCount || 0,
          totalRevenue,
          recentRegistrations: recentRegs,
        })
      } catch (err) {
        console.error('Error loading dashboard stats:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    loadDashboardStats()
  }, [router, clubId, authLoading, authError, selectedSeason, seasonLoading])

  if (authLoading || seasonLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading dashboard…</p>
      </div>
    )
  }

  if (error || authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error || authError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.refresh()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your ski program operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Athletes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAthletes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Programs
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePrograms}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Registrations
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalRegistrations}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRevenue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/programs/new" className="block">
              <Button className="w-full justify-start" variant="outline">
                <BookOpen className="mr-2 h-4 w-4" />
                Create New Program
              </Button>
            </Link>
            <Link href="/admin/athletes/new" className="block">
              <Button className="w-full justify-start" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Add New Athlete
              </Button>
            </Link>
            <Link href="/admin/reports" className="block">
              <Button className="w-full justify-start" variant="outline">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Navigation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/programs" className="block">
              <Button className="w-full justify-start" variant="outline">
                <BookOpen className="mr-2 h-4 w-4" />
                Manage Programs
              </Button>
            </Link>
            <Link href="/admin/registrations" className="block">
              <Button className="w-full justify-start" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                View Registrations
              </Button>
            </Link>
            <Link href="/admin/athletes" className="block">
              <Button className="w-full justify-start" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Manage Athletes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Registrations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Registrations</CardTitle>
          <CardDescription>Latest athlete registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentRegistrations.length > 0 ? (
            <div className="space-y-4">
              {stats.recentRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {reg.athlete?.first_name} {reg.athlete?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {reg.program?.name}
                    </p>
                  </div>
                  <div className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium capitalize text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {reg.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No registrations yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}