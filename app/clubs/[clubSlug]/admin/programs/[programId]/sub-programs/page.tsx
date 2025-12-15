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
import { useSelectedSeason } from '@/lib/contexts/season-context'
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
  const params = useParams() as { clubSlug?: string; programId?: string }
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const rawProgramId = params.programId
  const programId =
    Array.isArray(rawProgramId) ? rawProgramId[0] : rawProgramId

  const { profile, loading: authLoading } = useRequireAdmin()
  const selectedSeason = useSelectedSeason()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Guard against invalid programId
  if (!programId || programId === 'undefined') {
    router.push(`${basePath}/programs`)
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

  // Admin view: Show ALL sub-programs (active + inactive)
  const allSubPrograms = subPrograms as SubProgram[]

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
    authLoading || programsLoading || subProgramsLoading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading sub-programs…" />
  }

  // Show error state
  if (subProgramsError) {
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
            <Button variant="outline" onClick={() => router.push(`${basePath}/programs`)}>
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
            onClick={() => router.push(`${basePath}/programs`)}
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
        <Link href={`${basePath}/programs/${programId}/sub-programs/new`}>
          <Button>Add Sub-Program</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sub-Programs</CardTitle>
          <CardDescription>
            All sub-programs for this program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allSubPrograms.length > 0 ? (
            <div className="space-y-4">
              {allSubPrograms.map((subProgram) => (
                <div
                  key={subProgram.id}
                  className="flex items-start justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{subProgram.name}</h3>
                      {subProgram.status === ProgramStatus.INACTIVE && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                          Inactive
                        </span>
                      )}
                    </div>
                    {subProgram.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {subProgram.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`${basePath}/sub-programs/${subProgram.id}/edit`}>
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
              No sub-programs yet. Click &quot;Add Sub-Program&quot; to
              create one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


