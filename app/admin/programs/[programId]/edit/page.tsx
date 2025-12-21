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
  const params = useParams() as { programId?: string | string[] }
  const queryClient = useQueryClient()

  const rawProgramId = params.programId
  const programId =
    Array.isArray(rawProgramId) ? rawProgramId[0] : rawProgramId

  const { profile, loading: authLoading } = useRequireAdmin()
  const { data: allPrograms = [], isLoading: programsLoading } = usePrograms()

  // Guard against invalid programId
  if (!programId || programId === 'undefined') {
    router.push('/admin/programs')
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
  const [isActive, setIsActive] = useState(true)

  // Initialize form when program is loaded
  // Use program ID instead of program object to avoid infinite loops
  useEffect(() => {
    if (program) {
      // Only update if values actually changed to prevent unnecessary re-renders
      setName((prev) => (prev !== (program.name ?? '') ? program.name ?? '' : prev))
      setDescription((prev) => (prev !== (program.description ?? '') ? program.description ?? '' : prev))
      const newIsActive = program.status === ProgramStatus.ACTIVE || !program.status
      setIsActive((prev) => (prev !== newIsActive ? newIsActive : prev))
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

    const newStatus = isActive ? ProgramStatus.ACTIVE : ProgramStatus.INACTIVE

    // PHASE 2: RLS ensures user can only update programs in their club
    const result = await programsService.updateProgram(programId, {
      name,
      description: description || null,
      status: newStatus,
    } as any)

    if (result.error) {
      console.error('[EditProgram] update error:', result.error)
      setError(result.error.message)
      setSaving(false)
    } else {
      // Force refetch to ensure cache is updated before redirect
      await queryClient.refetchQueries({ queryKey: ['programs'] })
      router.push('/admin/programs')
    }
  }

  const isLoading = authLoading || programsLoading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading program…" />
  }

  // Show error state
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          setError(null)
          router.refresh()
        }}
      />
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
              The program you're looking for doesn't exist or you don't have
              access to it.
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
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/programs')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Programs
        </Button>
        <h1 className="text-3xl font-bold">Edit Program</h1>
        <p className="text-muted-foreground">Update program details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Program Details</CardTitle>
          <CardDescription>Edit the program information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium mb-1"
              >
                Program Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-1"
              >
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Active Program
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/programs')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
