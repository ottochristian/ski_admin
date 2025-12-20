'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { ProgramStatus } from '@/lib/programStatus'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { useRequireAdmin } from '@/lib/auth-context'
import { useSeason } from '@/lib/hooks/use-season'
import { usePrograms } from '@/lib/hooks/use-programs'
import { useSubProgramsByProgram } from '@/lib/hooks/use-sub-programs'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

type Program = {
  id: string
  name: string
}

type SubProgram = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus
}

export default function SubProgramsPage() {
  const router = useRouter()
  const params = useParams() as { programId?: string }
  const rawProgramId = params.programId
  const programId =
    Array.isArray(rawProgramId) ? rawProgramId[0] : rawProgramId

  const { profile, loading: authLoading } = useRequireAdmin()
  const { selectedSeason, loading: seasonLoading } = useSeason()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Guard against invalid programId
  if (!programId || programId === 'undefined') {
    router.push('/admin/programs')
    return null
  }

  // PHASE 2: RLS handles club filtering automatically
  const { data: allPrograms = [], isLoading: programsLoading } = usePrograms(
    selectedSeason?.id
  )
  const {
    data: subPrograms = [],
    isLoading: subProgramsLoading,
    error: subProgramsError,
    refetch: refetchSubPrograms,
  } = useSubProgramsByProgram(programId, selectedSeason?.id)

  // Find the program
  const program = allPrograms.find((p: any) => p.id === programId) as
    | Program
    | undefined

  // Filter to active sub-programs only
  const activeSubPrograms = subPrograms.filter(
    (sp: any) => sp.status === ProgramStatus.ACTIVE
  ) as SubProgram[]

  async function handleDelete(subProgramId: string) {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this sub-program? This will also delete all its groups. You cannot undo this from the UI.'
    )

    if (!confirmDelete) return

    setDeletingId(subProgramId)

    const { error } = await supabase.rpc('soft_delete_sub_program', {
      sub_program_id: subProgramId,
    })

    if (error) {
      console.error('Error soft deleting sub-program:', error)
      alert(`Error deleting sub-program: ${error.message}`)
    } else {
      // Refetch sub-programs list
      refetchSubPrograms()
    }

    setDeletingId(null)
  }

  const isLoading =
    authLoading || seasonLoading || programsLoading || subProgramsLoading

  // Show loading state
  // Show error state (but don't block entire page)
  if (!authLoading && subProgramsError) {
    return (
      <ErrorState error={subProgramsError} onRetry={() => refetchSubPrograms()} />
    )
  }

  // Show message if program not found
  if (!program) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Program Not Found</CardTitle>
            <CardDescription>
              The program you're looking for doesn't exist or doesn't belong to
              this season.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push('/admin/programs')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Programs
            </Button>
          </CardContent>
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
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/programs')}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Programs
          </Button>
          <h1 className="text-2xl font-bold">{program.name} - Sub-Programs</h1>
          <p className="text-muted-foreground">
            Manage sub-programs for this program
          </p>
        </div>
        <Link href={`/admin/programs/${programId}/sub-programs/new`}>
          <Button>Add Sub-Program</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Sub-Programs</CardTitle>
          <CardDescription>
            All active sub-programs for this program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSubPrograms.length > 0 ? (
            <div className="space-y-4">
              {activeSubPrograms.map((subProgram) => (
                <div
                  key={subProgram.id}
                  className="flex items-start justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{subProgram.name}</h3>
                    {subProgram.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {subProgram.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/sub-programs/${subProgram.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(subProgram.id)}
                      disabled={deletingId === subProgram.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingId === subProgram.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No active sub-programs yet. Click &quot;Add Sub-Program&quot; to
              create one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
