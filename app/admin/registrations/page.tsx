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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAdminClub } from '@/lib/use-admin-club'
import { useAdminSeason } from '@/lib/use-admin-season'
import { clubQuery } from '@/lib/supabase-helpers'
import { AdminPageHeader } from '@/components/admin-page-header'

interface Registration {
  id: string
  athlete_id: string
  program_id: string
  parent_id: string
  status: string
  payment_status: string
  amount_paid: number
  created_at: string
  athlete?: {
    id: string
    first_name?: string
    last_name?: string
    date_of_birth?: string
  }
  program?: {
    id: string
    name: string
  }
  parent?: {
    id: string
    email: string
  }
}

export default function RegistrationsPage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const { selectedSeason, loading: seasonLoading } = useAdminSeason()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRegistrations() {
      if (authLoading || seasonLoading || !clubId || !selectedSeason) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      try {
        // Fetch registrations with related data, filtered by club and season
        const { data, error: registrationsError } = await clubQuery(
          supabase
            .from('registrations')
            .select(
              `
            id,
            athlete_id,
            sub_program_id,
            status,
            payment_status,
            amount_paid,
            created_at,
            season_id,
            athletes(id, first_name, last_name, date_of_birth, household_id, family_id),
            sub_programs(name, programs(name))
          `
            )
            .eq('season_id', selectedSeason.id)
            .order('created_at', { ascending: false }),
          clubId
        )

        if (registrationsError) {
          setError(registrationsError.message)
          setLoading(false)
          return
        }

        // Extract unique household_ids and family_ids
        const householdIds = new Set<string>()
        const familyIds = new Set<string>()
        ;(data || []).forEach((reg: any) => {
          if (reg.athletes?.household_id) {
            householdIds.add(reg.athletes.household_id)
          }
          if (reg.athletes?.family_id) {
            familyIds.add(reg.athletes.family_id)
          }
        })

        // Fetch parent emails for households via household_guardians -> profiles
        const parentEmailMap = new Map<string, string>()
        
        if (householdIds.size > 0) {
          const { data: householdGuardians } = await supabase
            .from('household_guardians')
            .select('household_id, profiles:user_id(email)')
            .in('household_id', Array.from(householdIds))

          if (householdGuardians) {
            householdGuardians.forEach((hg: any) => {
              if (hg.household_id && hg.profiles?.email) {
                parentEmailMap.set(hg.household_id, hg.profiles.email)
              }
            })
          }
        }

        // Fetch parent emails for families via profiles
        if (familyIds.size > 0) {
          const { data: families } = await supabase
            .from('families')
            .select('id, profile_id')
            .in('id', Array.from(familyIds))

          if (families) {
            const profileIds = families.map((f: any) => f.profile_id).filter(Boolean)
            if (profileIds.length > 0) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email')
                .in('id', profileIds)

              if (profiles) {
                const profileEmailMap = new Map(profiles.map((p: any) => [p.id, p.email]))
                families.forEach((f: any) => {
                  if (f.id && f.profile_id && profileEmailMap.has(f.profile_id)) {
                    parentEmailMap.set(f.id, profileEmailMap.get(f.profile_id)!)
                  }
                })
              }
            }
          }
        }

        // Transform data to match our interface and add parent emails
        const transformedData = (data || []).map((reg: any) => {
          const athlete = reg.athletes
          const householdId = athlete?.household_id
          const familyId = athlete?.family_id
          const parentEmail = (householdId && parentEmailMap.get(householdId)) ||
                             (familyId && parentEmailMap.get(familyId)) ||
                             null

          return {
            ...reg,
            athlete: {
              id: athlete?.id,
              first_name: athlete?.first_name,
              last_name: athlete?.last_name,
              date_of_birth: athlete?.date_of_birth,
            },
            program: reg.sub_programs?.programs || { name: reg.sub_programs?.name || 'Unknown' },
            parent: parentEmail ? { email: parentEmail } : null,
          }
        })

        setRegistrations(transformedData)
      } catch (err) {
        console.error('Error loading registrations:', err)
        setError('Failed to load registrations')
      } finally {
        setLoading(false)
      }
    }

    loadRegistrations()
  }, [router, clubId, authLoading, authError, selectedSeason, seasonLoading])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading registrations…</p>
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

  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase() || ''
    switch (normalizedStatus) {
      case 'confirmed':
      case 'processed':
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'pending':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'unpaid':
      case 'late':
      case 'cancelled':
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase() || ''
    switch (normalizedStatus) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'pending':
      case 'processing':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'unpaid':
      case 'late':
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Registrations"
        description="View and manage all program registrations"
      />

      <Card>
        <CardHeader>
          <CardTitle>All Registrations</CardTitle>
          <CardDescription>Complete list of athlete registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {registrations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Parent Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">
                        {reg.athlete?.first_name} {reg.athlete?.last_name}
                      </TableCell>
                      <TableCell>{reg.program?.name}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {reg.parent?.email || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${getStatusColor(
                            reg.status
                          )}`}
                        >
                          {reg.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${getPaymentStatusColor(
                            reg.payment_status
                          )}`}
                        >
                          {reg.payment_status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(reg.amount_paid || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No registrations yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
