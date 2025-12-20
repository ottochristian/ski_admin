'use client'

import { useMemo } from 'react'
import { useRequireAdmin } from '@/lib/auth-context'
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { usePrograms } from '@/lib/hooks/use-programs'
import { useRegistrations } from '@/lib/hooks/use-registrations'
import { AdminPageHeader } from '@/components/admin-page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'
import { ProgramStatus } from '@/lib/programStatus'

export default function ReportsPage() {
  const { profile, loading: authLoading } = useRequireAdmin()
  const selectedSeason = useSelectedSeason()

  // PHASE 2: RLS handles club filtering automatically
  const { data: allPrograms = [], isLoading: programsLoading } = usePrograms(
    selectedSeason?.id
  )
  const { data: allRegistrations = [], isLoading: registrationsLoading } =
    useRegistrations(selectedSeason?.id)

  // Filter to active programs only
  const programs = allPrograms.filter(
    (p: any) => p.status === ProgramStatus.ACTIVE || p.status === null
  )

  // Combine programs with their registrations
  const programsWithRegistrations = useMemo(() => {
    return programs.map((program: any) => {
      const programRegistrations = allRegistrations.filter(
        (reg: any) =>
          reg.sub_programs?.programs?.id === program.id ||
          (reg.program_id === program.id && !reg.sub_program_id)
      )

      return {
        ...program,
        registrations: programRegistrations,
      }
    })
  }, [programs, allRegistrations])

  // Calculate totals
  const totals = useMemo(() => {
    let revenue = 0
    let registrations = 0

    programsWithRegistrations.forEach((program: any) => {
      if (program.registrations) {
        registrations += program.registrations.length
        revenue += program.registrations.reduce((sum: number, reg: any) => {
          return sum + Number(reg.amount_paid || 0)
        }, 0)
      }
    })

    return { revenue, registrations }
  }, [programsWithRegistrations])

  const isLoading =
    authLoading ||
    programsLoading ||
    registrationsLoading

  // Show loading state
  // Don't block page render for data loading

  // Show message if no season exists
  if (!selectedSeason) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Season Selected</CardTitle>
            <CardDescription>
              Please select a season to view reports.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Auth check ensures profile exists
  if (!profile) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Reports"
        description="Financial and enrollment reports"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totals.revenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">from all programs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.registrations}</div>
            <p className="text-xs text-muted-foreground">active registrations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {programsWithRegistrations.length}
            </div>
            <p className="text-xs text-muted-foreground">programs offered</p>
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
            {programsWithRegistrations.length > 0 ? (
              programsWithRegistrations.map((program: any) => {
                const totalEnrolled = program.registrations?.length || 0
                const totalRevenue =
                  program.registrations?.reduce(
                    (sum: number, reg: any) =>
                      sum + Number(reg.amount_paid || 0),
                    0
                  ) || 0
                const paidCount =
                  program.registrations?.filter(
                    (reg: any) => reg.payment_status === 'paid'
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
                          {totalEnrolled}/{program.max_participants || 'unlimited'}
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


