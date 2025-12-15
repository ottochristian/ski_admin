'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ProgramStatus } from '@/lib/programStatus'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRequireAdmin } from '@/lib/auth-context'
import { usePrograms } from '@/lib/hooks/use-programs'
import { programsService } from '@/lib/services/programs-service'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'
import { useQueryClient } from '@tanstack/react-query'

type Program = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus | null
}

export default function EditProgramPage() {
  const router = useRouter()
  const params = useParams() as { clubSlug?: string; programId?: string | string[] }
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const queryClient = useQueryClient()

  const rawProgramId = params.programId
  const programId =
    Array.isArray(rawProgramId) ? rawProgramId[0] : rawProgramId

  const { profile, loading: authLoading } = useRequireAdmin()
  const { data: allPrograms = [], isLoading: programsLoading } = usePrograms()

  // Guard against invalid programId
  if (!programId || programId === 'undefined') {
    router.push(`${basePath}/programs`)
    return null
  }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find the program from the list
  const program = allPrograms.find((p: any) => p.id === programId) as
    | Program
    | undefined

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProgramStatus>(ProgramStatus.ACTIVE)

  // Initialize form when program is loaded
  // Use program ID instead of program object to avoid infinite loops
  useEffect(() => {
    if (program) {
      // Only update if values actually changed to prevent unnecessary re-renders
      setName((prev) => (prev !== (program.name ?? '') ? program.name ?? '' : prev))
      setDescription((prev) => (prev !== (program.description ?? '') ? program.description ?? '' : prev))
      const newStatus = program.status || ProgramStatus.ACTIVE
      setStatus((prev) => (prev !== newStatus ? newStatus : prev))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id, program?.name, program?.description, program?.status])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!programId || programId === 'undefined') {
      console.error('[EditProgram] handleSave with invalid programId', programId)
      return
    }

    setSaving(true)
    setError(null)

    // PHASE 2: RLS ensures user can only update programs in their club
    const result = await programsService.updateProgram(programId, {
      name,
      description: description || null,
      status,
    } as any)

    if (result.error) {
      console.error('[EditProgram] update error:', result.error)
      setError(result.error.message)
      setSaving(false)
    } else {
      // Invalidate queries to refresh the programs list
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      router.push(`${basePath}/programs`)
    }
  }

  const isLoading = authLoading || programsLoading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading program…" />
  }

  // Show error if program not found
  if (!program) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState
          error="Program not found"
          onRetry={() => router.push(`${basePath}/programs`)}
        />
        <Link href={`${basePath}/programs`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programs
          </Button>
        </Link>
      </div>
    )
  }

  // Auth check ensures profile exists
  if (!profile) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href={`${basePath}/programs`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Program</h1>
          <p className="text-muted-foreground">
            Update program details
          </p>
        </div>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Program Details</CardTitle>
          <CardDescription>
            Update the program name, description, and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                Program Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Alpine, Freeride, Nordic, Snowboard..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Short description of this program..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as ProgramStatus)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={ProgramStatus.ACTIVE}>Active - Visible to parents</option>
                <option value={ProgramStatus.INACTIVE}>Inactive - Hidden from parents</option>
              </select>
              <p className="text-xs text-slate-600 mt-1">
                Active programs are visible in the parent portal when the season is active.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Link href={`${basePath}/programs`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


