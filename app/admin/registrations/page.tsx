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
            athletes(id, first_name, last_name, date_of_birth),
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

        // Transform data to match our interface
        const transformedData = (data || []).map((reg: any) => ({
          ...reg,
          athlete: reg.athletes,
          program: reg.sub_programs?.programs || { name: reg.sub_programs?.name || 'Unknown' },
        }))

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

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'unpaid':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Registrations</h1>
        <p className="text-muted-foreground">
          View and manage all program registrations
        </p>
      </div>

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
                          {reg.parent?.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium capitalize text-blue-800 dark:bg-blue-900 dark:text-blue-200">
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
