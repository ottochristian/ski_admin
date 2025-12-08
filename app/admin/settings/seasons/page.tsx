'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAdminClub } from '@/lib/use-admin-club'
import { useAdminSeason, Season } from '@/lib/use-admin-season'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Archive, CheckCircle2, Calendar, Copy } from 'lucide-react'
import { clubQuery } from '@/lib/supabase-helpers'
import { ProgramStatus } from '@/lib/programStatus'

export default function SeasonsPage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const { seasons, loading: seasonsLoading, error: seasonsError } = useAdminSeason()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [cloningSeasonId, setCloningSeasonId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft')

  useEffect(() => {
    if (seasonsError) {
      setError(seasonsError)
    }
  }, [seasonsError])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()

    if (!clubId) {
      setError('No club associated with your account')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // If setting as current, unset other current seasons first
      if (isCurrent) {
        await clubQuery(
          supabase
            .from('seasons')
            .update({ is_current: false })
            .eq('is_current', true),
          clubId
        )
      }

      const { error: insertError } = await clubQuery(
        supabase.from('seasons').insert([
          {
            name,
            start_date: startDate,
            end_date: endDate,
            is_current: isCurrent,
            status,
            club_id: clubId,
          },
        ]),
        clubId
      )

      if (insertError) {
        setError(insertError.message)
      } else {
        // Reset form
        setName('')
        setStartDate('')
        setEndDate('')
        setIsCurrent(false)
        setStatus('draft')
        setShowCreateForm(false)
        router.refresh()
      }
    } catch (err) {
      console.error('Error creating season:', err)
      setError('Failed to create season')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetCurrent(seasonId: string) {
    if (!clubId) {
      setError('No club associated with your account')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // First, verify the season belongs to this club
      const { data: seasonData, error: verifyError } = await clubQuery(
        supabase
          .from('seasons')
          .select('id, name')
          .eq('id', seasonId)
          .single(),
        clubId
      )

      if (verifyError || !seasonData) {
        setError('Season not found or does not belong to your club')
        setLoading(false)
        return
      }

      // Unset all current seasons for this club
      const { error: unsetError } = await clubQuery(
        supabase
          .from('seasons')
          .update({ is_current: false })
          .eq('is_current', true),
        clubId
      )

      if (unsetError) {
        console.error('Error unsetting current seasons:', unsetError)
        setError(`Failed to unset current seasons: ${unsetError.message}`)
        setLoading(false)
        return
      }

      // Set this one as current
      const { error: updateError } = await clubQuery(
        supabase
          .from('seasons')
          .update({ is_current: true })
          .eq('id', seasonId),
        clubId
      )

      if (updateError) {
        console.error('Error setting current season:', updateError)
        setError(`Failed to set current season: ${updateError.message}`)
      } else {
        // Success - refresh the page and clear cached season selection
        if (typeof window !== 'undefined') {
          localStorage.removeItem('selectedSeasonId')
        }
        // Use window.location to force a full page refresh
        window.location.reload()
      }
    } catch (err) {
      console.error('Error setting current season:', err)
      setError(`Failed to set current season: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleArchive(seasonId: string) {
    if (!confirm('Are you sure you want to archive this season? This will hide it from most views.')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await clubQuery(
        supabase
          .from('seasons')
          .update({ status: 'archived' })
          .eq('id', seasonId),
        clubId
      )

      if (error) {
        setError(error.message)
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error('Error archiving season:', err)
      setError('Failed to archive season')
    } finally {
      setLoading(false)
    }
  }

  async function handleCloneSeason(sourceSeasonId: string) {
    if (!clubId) {
      setError('No club associated with your account')
      return
    }

    const sourceSeason = seasons.find(s => s.id === sourceSeasonId)
    if (!sourceSeason) {
      setError('Source season not found')
      return
    }

    const newSeasonName = prompt(
      `Enter name for the new season (cloning from ${sourceSeason.name}):`,
      `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    )

    if (!newSeasonName) {
      return
    }

    setCloningSeasonId(sourceSeasonId)
    setLoading(true)
    setError(null)

    try {
      // 1. Create new season
      // Calculate dates: keep the same month/day as source, but adjust year
      const sourceStart = new Date(sourceSeason.start_date)
      const sourceEnd = new Date(sourceSeason.end_date)
      const currentYear = new Date().getFullYear()
      
      const newStartDate = new Date(currentYear, sourceStart.getMonth(), sourceStart.getDate())
      const newEndDate = new Date(currentYear + 1, sourceEnd.getMonth(), sourceEnd.getDate())

      const { data: newSeason, error: seasonError } = await clubQuery(
        supabase
          .from('seasons')
          .insert([
            {
              name: newSeasonName,
              start_date: newStartDate.toISOString().split('T')[0],
              end_date: newEndDate.toISOString().split('T')[0],
              is_current: false,
              status: 'draft',
              club_id: clubId,
            },
          ])
          .select()
          .single(),
        clubId
      )

      if (seasonError || !newSeason) {
        setError(seasonError?.message || 'Failed to create new season')
        setLoading(false)
        setCloningSeasonId(null)
        return
      }

      // 2. Fetch all programs from source season with sub-programs and groups
      const { data: sourcePrograms, error: programsError } = await clubQuery(
        supabase
          .from('programs')
          .select(`
            id,
            name,
            description,
            status,
            sub_programs (
              id,
              name,
              description,
              status,
              registration_fee,
              max_capacity,
              is_active,
              groups (
                id,
                name,
                status
              )
            )
          `)
          .eq('season_id', sourceSeasonId),
        clubId
      )

      if (programsError) {
        setError(`Failed to load programs: ${programsError.message}`)
        setLoading(false)
        setCloningSeasonId(null)
        return
      }

      // 3. Clone programs and sub-programs
      for (const program of sourcePrograms || []) {
        // Create new program
        const { data: newProgram, error: programError } = await clubQuery(
          supabase
            .from('programs')
            .insert([
              {
                name: program.name,
                description: program.description,
                status: ProgramStatus.INACTIVE, // Start as inactive so admin can review
                season_id: newSeason.id,
                club_id: clubId,
              },
            ])
            .select()
            .single(),
          clubId
        )

        if (programError || !newProgram) {
          console.error('Error cloning program:', program.name, programError)
          continue
        }

        // Clone sub-programs and their groups
        if (program.sub_programs && program.sub_programs.length > 0) {
          for (const sp of program.sub_programs) {
            // Create new sub-program
            const { data: newSubProgram, error: subProgramError } = await clubQuery(
              supabase
                .from('sub_programs')
                .insert([
                  {
                    program_id: newProgram.id,
                    name: sp.name,
                    description: sp.description,
                    status: ProgramStatus.INACTIVE,
                    registration_fee: sp.registration_fee || null,
                    max_capacity: sp.max_capacity || null,
                    is_active: false, // Start as inactive
                    season_id: newSeason.id,
                    club_id: clubId,
                  },
                ])
                .select()
                .single(),
              clubId
            )

            if (subProgramError || !newSubProgram) {
              console.error('Error cloning sub-program:', sp.name, subProgramError)
              continue
            }

            // Clone groups for this sub-program
            if (sp.groups && sp.groups.length > 0) {
              const groupsToInsert = sp.groups.map((group: any) => ({
                sub_program_id: newSubProgram.id,
                name: group.name,
                status: ProgramStatus.INACTIVE, // Start as inactive
                club_id: clubId,
              }))

              const { error: groupsError } = await clubQuery(
                supabase.from('groups').insert(groupsToInsert),
                clubId
              )

              if (groupsError) {
                console.error('Error cloning groups for sub-program:', sp.name, groupsError)
              }
            }
          }
        }
      }

      // Count total items cloned
      const totalSubPrograms = sourcePrograms?.reduce((sum: number, p: any) => sum + (p.sub_programs?.length || 0), 0) || 0
      const totalGroups = sourcePrograms?.reduce((sum: number, p: any) => 
        sum + (p.sub_programs?.reduce((spSum: number, sp: any) => spSum + (sp.groups?.length || 0), 0) || 0), 0
      ) || 0

      router.refresh()
      alert(
        `Successfully cloned from ${sourceSeason.name} to ${newSeasonName}:\n` +
        `- ${sourcePrograms?.length || 0} programs\n` +
        `- ${totalSubPrograms} sub-programs\n` +
        `- ${totalGroups} groups\n\n` +
        `All items are set to INACTIVE for review.`
      )
    } catch (err) {
      console.error('Error cloning season:', err)
      setError('Failed to clone season')
    } finally {
      setLoading(false)
      setCloningSeasonId(null)
    }
  }

  if (authLoading || seasonsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading seasons…</p>
      </div>
    )
  }

  if (authError || seasonsError) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{authError || seasonsError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeSeasons = seasons.filter(s => s.status !== 'archived')
  const archivedSeasons = seasons.filter(s => s.status === 'archived')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Seasons</h1>
          <p className="text-muted-foreground">
            Manage seasons for your club. Programs and registrations are scoped to seasons.
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showCreateForm ? 'Cancel' : 'Add Season'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Season</CardTitle>
            <CardDescription>
              Create a new season for your club. You can set it as the current season.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Season Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="2025-2026"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="isCurrent"
                    type="checkbox"
                    checked={isCurrent}
                    onChange={e => setIsCurrent(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="isCurrent" className="text-sm text-slate-700">
                    Set as current season
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={e =>
                      setStatus(e.target.value as 'draft' | 'active' | 'archived')
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating…' : 'Create Season'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Seasons</CardTitle>
          <CardDescription>
            Seasons that are currently in use or being set up
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSeasons.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active seasons yet. Create your first season to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {activeSeasons.map(season => (
                <div
                  key={season.id}
                  className="flex items-center justify-between border rounded-lg p-4"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{season.name}</h3>
                        {season.is_current && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            <CheckCircle2 className="h-3 w-3" />
                            Current
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            season.status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {season.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(season.start_date).toLocaleDateString()} –{' '}
                        {new Date(season.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!season.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetCurrent(season.id)}
                        disabled={loading}
                      >
                        Set as Current
                      </Button>
                    )}
                    {season.status !== 'archived' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCloneSeason(season.id)}
                        disabled={loading || cloningSeasonId === season.id}
                        title="Clone programs and sub-programs from this season"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        {cloningSeasonId === season.id ? 'Cloning…' : 'Clone'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(season.id)}
                      disabled={loading}
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {archivedSeasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Archived Seasons</CardTitle>
            <CardDescription>Past seasons that are no longer active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {archivedSeasons.map(season => (
                <div
                  key={season.id}
                  className="flex items-center justify-between border rounded-lg p-4 opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <div>
                      <h3 className="font-semibold text-slate-900">{season.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(season.start_date).toLocaleDateString()} –{' '}
                        {new Date(season.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
