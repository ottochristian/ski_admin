'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { useRequireAdmin } from '@/lib/auth-context'
import { useSeason } from '@/lib/hooks/use-season'
import { useAthletesCount } from '@/lib/hooks/use-athletes'
import { usePrograms } from '@/lib/hooks/use-programs'
import {
  useRegistrationsCount,
  useTotalRevenue,
  useRecentRegistrations,
} from '@/lib/hooks/use-registrations'
import { AdminPageHeader } from '@/components/admin-page-header'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'
import { programsService } from '@/lib/services/programs-service'

export default function AdminDashboard() {
  const router = useRouter()
  const { profile, loading: authLoading } = useRequireAdmin()
  const { selectedSeason, loading: seasonLoading } = useSeason()

  // PHASE 2: RLS handles club filtering automatically - no clubQuery needed!
  // React Query handles loading, error, and caching
  const { data: totalAthletes = 0, isLoading: athletesLoading } = useAthletesCount()
  
  // Get programs count (filter by status and season)
  const { data: allPrograms = [], isLoading: programsLoading } = usePrograms(selectedSeason?.id)
  const programsCount = allPrograms.filter((p: any) => p.status === 'ACTIVE').length

  const { data: totalRegistrations = 0, isLoading: registrationsLoading } =
    useRegistrationsCount(selectedSeason?.id)
  const { data: totalRevenue = 0, isLoading: revenueLoading } = useTotalRevenue(
    selectedSeason?.id
  )
  const {
    data: recentRegistrations = [],
    isLoading: recentRegsLoading,
  } = useRecentRegistrations(selectedSeason?.id || null, 5)

  // Transform recent registrations to match expected format
  const transformedRecentRegs = recentRegistrations.map((reg: any) => ({
    ...reg,
    athlete: reg.athletes,
    program: reg.sub_programs?.programs || { name: reg.sub_programs?.name || 'Unknown' },
  }))

  const isLoading =
    authLoading ||
    seasonLoading ||
    athletesLoading ||
    programsLoading ||
    registrationsLoading ||
    revenueLoading ||
    recentRegsLoading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading dashboard…" />
  }

  // Auth check ensures profile exists
  if (!profile) {
    return null
  }

  // Show message if no season exists
  if (!selectedSeason) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Season Found</CardTitle>
            <CardDescription>
              No season has been created for your club yet. Please create a season first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin/settings/seasons">Go to Seasons</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Dashboard"
        description="Overview of your ski program operations"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Athletes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAthletes}</div>
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
            <div className="text-2xl font-bold">{programsCount}</div>
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
              {totalRegistrations}
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
              ${totalRevenue.toFixed(2)}
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
          {transformedRecentRegs.length > 0 ? (
            <div className="space-y-4">
              {transformedRecentRegs.map((reg) => (
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