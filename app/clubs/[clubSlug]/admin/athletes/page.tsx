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
import { Plus, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useRequireAdmin } from '@/lib/auth-context'
import { useAthletes } from '@/lib/hooks/use-athletes'
import { AdminPageHeader } from '@/components/admin-page-header'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

interface Registration {
  id: string
  status: string
  payment_status: string
  season_id: string
  sub_program_id: string
  seasons: {
    id: string
    name: string
    is_current: boolean
  }
  sub_programs: {
    id: string
    name: string
    programs: {
      id: string
      name: string
    }
  }
}

interface Athlete {
  id: string
  first_name?: string
  last_name?: string
  date_of_birth?: string
  parent_id?: string
  registrations?: Registration[]
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

  // Helper function to get athlete's latest season
  const getLatestSeason = (athlete: Athlete) => {
    if (!athlete.registrations || athlete.registrations.length === 0) return null
    // Sort by is_current first, then by season name (descending)
    const sorted = [...athlete.registrations].sort((a, b) => {
      if (a.seasons?.is_current && !b.seasons?.is_current) return -1
      if (!a.seasons?.is_current && b.seasons?.is_current) return 1
      return (b.seasons?.name || '').localeCompare(a.seasons?.name || '')
    })
    return sorted[0]?.seasons
  }

  // Helper function to get unique programs
  const getPrograms = (athlete: Athlete) => {
    if (!athlete.registrations || athlete.registrations.length === 0) return []
    const programs = athlete.registrations
      .map(reg => reg.sub_programs?.programs?.name)
      .filter((name, index, self) => name && self.indexOf(name) === index)
    return programs as string[]
  }

  // Helper function to get payment status
  const getPaymentStatus = (athlete: Athlete) => {
    if (!athlete.registrations || athlete.registrations.length === 0) return null
    const latestReg = athlete.registrations[0]
    return latestReg?.payment_status
  }

  // Helper function to get registration status
  const getRegistrationStatus = (athlete: Athlete) => {
    if (!athlete.registrations || athlete.registrations.length === 0) return null
    const latestReg = athlete.registrations[0]
    return latestReg?.status
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
              {athletes.map((athlete) => {
                const latestSeason = getLatestSeason(athlete)
                const programs = getPrograms(athlete)
                const paymentStatus = getPaymentStatus(athlete)
                const regStatus = getRegistrationStatus(athlete)

                return (
                  <div
                    key={athlete.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium">
                          {athlete.first_name} {athlete.last_name}
                        </p>
                      </div>
                      {athlete.date_of_birth && (
                        <p className="text-sm text-muted-foreground mb-2">
                          DOB: {new Date(athlete.date_of_birth).toLocaleDateString()}
                        </p>
                      )}
                      
                      {/* Tags */}
                      <div className="flex flex-wrap gap-2">
                        {/* Latest Season Tag */}
                        {latestSeason && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            latestSeason.is_current 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            <CheckCircle className="h-3 w-3" />
                            {latestSeason.name}
                          </span>
                        )}

                        {/* Program Tags */}
                        {programs.map((program, idx) => (
                          <span 
                            key={idx}
                            className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                          >
                            {program}
                          </span>
                        ))}

                        {/* Payment Status Tag */}
                        {paymentStatus && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            paymentStatus === 'paid' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : paymentStatus === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {paymentStatus === 'paid' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : paymentStatus === 'pending' ? (
                              <Clock className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {paymentStatus}
                          </span>
                        )}

                        {/* Registration Status Tag */}
                        {regStatus && (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            regStatus === 'active'
                              ? 'bg-violet-100 text-violet-800'
                              : regStatus === 'pending'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {regStatus}
                          </span>
                        )}

                        {/* No Registrations Message */}
                        {(!athlete.registrations || athlete.registrations.length === 0) && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            No registrations
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </div>
                )
              })}
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


