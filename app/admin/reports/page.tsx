'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAdminClub } from '@/lib/use-admin-club'
import { clubQuery } from '@/lib/supabase-helpers'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Program {
  id: string
  name: string
  price?: number
  max_participants?: number
  registrations: Array<{
    id: string
    status: string
    payment_status: string
    amount_paid: number
  }>
}

export default function ReportsPage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalRegistrations, setTotalRegistrations] = useState(0)

  useEffect(() => {
    async function loadReports() {
      if (authLoading || !clubId) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      try {
        // Fetch programs with registrations, filtered by club
        const { data, error: programsError } = await clubQuery(
          supabase
            .from('programs')
            .select(
              `
            id,
            name,
            registrations(
              id,
              status,
              payment_status,
              amount_paid
            )
          `
            )
            .eq('status', 'ACTIVE')
            .order('name', { ascending: true }),
          clubId
        )

        if (programsError) {
          setError(programsError.message)
          setLoading(false)
          return
        }

        const programsData = (data || []) as Program[]
        setPrograms(programsData)

        // Calculate totals
        let revenue = 0
        let registrations = 0

        programsData.forEach((program) => {
          if (program.registrations) {
            registrations += program.registrations.length
            revenue += program.registrations.reduce((sum, reg) => {
              return sum + Number(reg.amount_paid || 0)
            }, 0)
          }
        })

        setTotalRevenue(revenue)
        setTotalRegistrations(registrations)
      } catch (err) {
        console.error('Error loading reports:', err)
        setError('Failed to load reports')
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [router, clubId, authLoading, authError])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading reports…</p>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Financial and enrollment reports
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              from all programs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations}</div>
            <p className="text-xs text-muted-foreground">
              active registrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{programs.length}</div>
            <p className="text-xs text-muted-foreground">
              programs offered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report */}
      <Card>
        <CardHeader>
          <CardTitle>Program Revenue Report</CardTitle>
          <CardDescription>Revenue and enrollment by program</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {programs.length > 0 ? (
              programs.map((program) => {
                const totalEnrolled = program.registrations?.length || 0
                const totalRevenue = program.registrations?.reduce(
                  (sum, reg) => sum + Number(reg.amount_paid || 0),
                  0
                ) || 0
                const paidCount =
                  program.registrations?.filter(
                    (reg) => reg.payment_status === 'paid'
                  ).length || 0

                return (
                  <div
                    key={program.id}
                    className="border-b pb-4 last:border-0"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{program.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Program ID: {program.id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          ${totalRevenue.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Enrolled</p>
                        <p className="font-medium">
                          {totalEnrolled}/
                          {program.max_participants || 'unlimited'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid</p>
                        <p className="font-medium">{paidCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Unpaid</p>
                        <p className="font-medium">
                          {totalEnrolled - paidCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Price per Person</p>
                        <p className="font-medium">
                          ${Number(program.price || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No active programs
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
