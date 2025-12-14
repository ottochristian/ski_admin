'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRequireAdmin } from '@/lib/auth-context'
import { useAdminSeason } from '@/lib/use-admin-season'
import { usePrograms } from '@/lib/hooks/use-programs'
import { ProgramStatus } from '@/lib/programStatus'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'
import { InlineLoading, ErrorState, EmptyState } from '@/components/ui/loading-states'
import { useClub } from '@/lib/club-context'

type SubProgram = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus
  program_id: string
}

type ProgramWithSubPrograms = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus | null
  sub_programs?: SubProgram[]
}

/**
 * Migrated Programs Page - Phase 1 Proof of Concept
 * 
 * Changes from original:
 * - Uses unified auth context (useRequireAdmin) instead of useAdminClub
 * - Uses React Query for data fetching (usePrograms hook)
 * - Uses standardized loading/error components
 * - Cleaner separation of concerns
 */
export default function ProgramsPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useRequireAdmin()
  const { selectedSeason, loading: seasonLoading } = useAdminSeason()
  const { club } = useClub()

  // React Query hook for programs - RLS handles club filtering automatically!
  // No need to pass clubId - much simpler!
  const {
    data: programs = [],
    isLoading,
    error,
    refetch,
  } = usePrograms(selectedSeason?.id, true) // Include sub_programs

  // Filter to active programs only (matching original behavior)
  const activePrograms = programs
    .filter((p) => p.status === ProgramStatus.ACTIVE || p.status === null)
    .map((program) => ({
      ...program,
      sub_programs: (program.sub_programs || []).filter(
        (sp: SubProgram) => sp.status === ProgramStatus.ACTIVE
      ),
    })) as ProgramWithSubPrograms[]

  // Show loading state
  if (authLoading || seasonLoading || isLoading) {
    return <InlineLoading message="Loading programs…" />
  }

  // Show error state
  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />
  }

  // Auth check ensures profile exists, but TypeScript needs this
  if (!profile || !club) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Programs"
          description="Manage all ski programs, including soft-deleting them."
        />
        <Link href="/admin/programs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Program
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Programs</CardTitle>
          <CardDescription>
            All active ski programs for {selectedSeason?.name || 'the selected season'} with their sub-programs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activePrograms.length === 0 ? (
            <EmptyState
              title="No active programs"
              description="Click 'Add Program' to create one."
              action={
                <Link href="/admin/programs/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Program
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-6">
              {activePrograms.map((program) => (
                <div
                  key={program.id}
                  className="border rounded-lg p-4 space-y-4"
                >
                  {/* Program Header */}
                  <div className="flex items-start justify-between border-b pb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {program.name}
                      </h3>
                      {program.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {program.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Link href={`/admin/programs/${program.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit Program
                        </Button>
                      </Link>
                      <Link
                        href={`/admin/programs/${program.id}/sub-programs/new`}
                      >
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Sub-program
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Sub-programs */}
                  {program.sub_programs && program.sub_programs.length > 0 ? (
                    <div className="pl-4 space-y-3">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">
                        Sub-programs:
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {program.sub_programs.map((subProgram) => (
                          <div
                            key={subProgram.id}
                            className="border rounded-md p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-slate-900 text-sm truncate">
                                  {subProgram.name}
                                </h5>
                                {subProgram.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {subProgram.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              <Link
                                href={`/admin/sub-programs/${subProgram.id}/edit`}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </Link>
                              <Link
                                href={`/admin/programs/${program.id}/sub-programs`}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pl-4">
                      <p className="text-sm text-muted-foreground italic">
                        No sub-programs yet.{' '}
                        <Link
                          href={`/admin/programs/${program.id}/sub-programs/new`}
                          className="text-blue-600 hover:underline"
                        >
                          Add one
                        </Link>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

