'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useRequireAdmin } from '@/lib/auth-context'
import { useSeason } from '@/lib/hooks/use-season'
import { useQueryClient } from '@tanstack/react-query'
import { programsService } from '@/lib/services/programs-service'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ProgramStatus } from '@/lib/programStatus'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

export default function NewProgramPage() {
  const router = useRouter()
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const queryClient = useQueryClient()
  const { profile, loading: authLoading } = useRequireAdmin()
  const { currentSeason, loading: seasonLoading } = useSeason()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    
    if (!profile?.club_id) {
      setError('No club associated with your account')
      return
    }

    if (!currentSeason) {
      setError('No current season found. Please create a season first.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // PHASE 2: RLS ensures user can only create programs in their club
      const result = await programsService.createProgram({
        name,
        description: description || undefined,
        status: isActive ? ProgramStatus.ACTIVE : ProgramStatus.INACTIVE,
        club_id: profile.club_id,
        season_id: currentSeason.id,
      })

      if (result.error) {
        setError(result.error.message)
        setSaving(false)
        return
      }

      // Invalidate programs query
      queryClient.invalidateQueries({ queryKey: ['programs'] })

      // Go back to programs list (club-aware route)
      router.push(`${basePath}/programs`)
    } catch (err) {
      console.error('Error creating program:', err)
      setError('Failed to create program')
      setSaving(false)
    }
  }

  const isLoading = authLoading || seasonLoading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading…" />
  }

  // Show error if no season
  if (!currentSeason) {
    return (
      <ErrorState
        error="No current season found. Please create a season first."
        onRetry={() => router.refresh()}
      />
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
          <h1 className="text-3xl font-bold tracking-tight">New Program</h1>
          <p className="text-muted-foreground">
            Create a new program for your club (e.g., Alpine, Freeride, Nordic).
          </p>
        </div>
        <Link href={`${basePath}/programs`}>
          <Button variant="outline">Back to Programs</Button>
        </Link>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Program Details</CardTitle>
          <CardDescription>
            This is the top-level program (e.g., Alpine, Freeride, Nordic, Snowboard).
            You can add sub-programs (Devo, Comp, etc.) later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm text-slate-800">
                Program is active
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <Link href={`${basePath}/programs`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create Program'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

