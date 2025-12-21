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
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { usePrograms } from '@/lib/hooks/use-programs'
import { subProgramsService } from '@/lib/services/sub-programs-service'
import { useQueryClient } from '@tanstack/react-query'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

type Program = {
  id: string
  name: string
}

export default function NewSubProgramPage() {
  const router = useRouter()
  const params = useParams() as { clubSlug?: string; programId?: string | string[] }
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const queryClient = useQueryClient()

  const rawProgramId = params.programId
  const programId =
    Array.isArray(rawProgramId) ? rawProgramId[0] : rawProgramId

  const { profile, loading: authLoading } = useRequireAdmin()
  const selectedSeason = useSelectedSeason()

  // Guard against invalid programId
  if (!programId || programId === 'undefined') {
    router.push(`${basePath}/programs`)
    return null
  }

  // PHASE 2: RLS handles club filtering automatically
  const { data: allPrograms = [], isLoading: programsLoading } = usePrograms(
    selectedSeason?.id
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find the program
  const program = allPrograms.find((p: any) => p.id === programId) as
    | Program
    | undefined

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [registrationFee, setRegistrationFee] = useState<string>('0')
  const [maxCapacity, setMaxCapacity] = useState<string>('')
  const [isActive, setIsActive] = useState(true)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!programId || programId === 'undefined' || !profile?.club_id) {
      console.error('[NewSubProgram] handleSave with invalid programId or club_id', {
        programId,
        club_id: profile?.club_id,
      })
      return
    }

    if (!selectedSeason) {
      setError('Please select a season first')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // PHASE 2: RLS ensures user can only create sub-programs in their club
      const result = await subProgramsService.createSubProgram({
        program_id: programId,
        name,
        description: description || null,
        registration_fee: registrationFee ? parseFloat(registrationFee) : null,
        max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
        status: isActive ? ProgramStatus.ACTIVE : ProgramStatus.INACTIVE,
        club_id: profile.club_id,
        season_id: selectedSeason.id,
      })

      if (result.error) {
        console.error('[NewSubProgram] create error:', result.error)
        setError(result.error.message)
        setSaving(false)
      } else {
        // Force immediate refetch to ensure cache is updated before redirect
        await queryClient.refetchQueries({ queryKey: ['programs'] })
        router.push(`${basePath}/programs`)
      }
    } catch (err) {
      console.error('[NewSubProgram] unexpected error:', err)
      setError('Failed to create sub-program')
      setSaving(false)
    }
  }

  const isLoading = authLoading || programsLoading

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push(`${basePath}/programs`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Programs
        </Button>
        {isLoading ? (
          <div>
            <h1 className="text-3xl font-bold">Add Sub-Program</h1>
            <InlineLoading message="Loading program…" />
          </div>
        ) : !program ? (
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Program Not Found</h1>
            <ErrorState
              error="The program you're looking for doesn't exist or you don't have access to it."
              onRetry={() => router.push(`${basePath}/programs`)}
            />
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold">Add Sub-Program to {program.name}</h1>
            <p className="text-muted-foreground">Create a new sub-program</p>
          </div>
        )}
      </div>

      {!isLoading && program && profile && (
        <Card>
          <CardHeader>
            <CardTitle>Sub-Program Details</CardTitle>
            <CardDescription>Enter the sub-program information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium mb-1"
              >
                Sub-Program Name *
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="registrationFee"
                  className="block text-sm font-medium mb-1"
                >
                  Registration Fee
                </label>
                <input
                  id="registrationFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={registrationFee}
                  onChange={(e) => setRegistrationFee(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="maxCapacity"
                  className="block text-sm font-medium mb-1"
                >
                  Max Capacity
                </label>
                <input
                  id="maxCapacity"
                  type="number"
                  min="1"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
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
                Active Sub-Program
              </label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Sub-Program'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(`${basePath}/programs`)
                }
              >
                Cancel
              </Button>
            </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


