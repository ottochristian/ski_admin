'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRequireAdmin } from '@/lib/auth-context'
import { useSeason } from '@/lib/contexts/season-context'
import {
  useCreateSeason,
  useUpdateSeason,
  useDeleteSeason,
} from '@/lib/hooks/use-season'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Archive, CheckCircle2, Calendar, Copy, Edit2, Lock, Unlock } from 'lucide-react'
import { ProgramStatus } from '@/lib/programStatus'
import { AdminPageHeader } from '@/components/admin-page-header'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

export default function SeasonsPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useRequireAdmin()
  const { seasons, loading: seasonsLoading } = useSeason()

  const createSeason = useCreateSeason()
  const updateSeason = useUpdateSeason()
  const deleteSeason = useDeleteSeason()

  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [cloningSeasonId, setCloningSeasonId] = useState<string | null>(null)

  // Form state
  // Form state
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [status, setStatus] = useState<'draft' | 'active' | 'closed' | 'archived'>('draft')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!profile?.club_id) {
      setError('No club associated with your account')
      return
    }

    setError(null)

    try {
      if (editingSeasonId) {
        // Update existing season
        await updateSeason.mutateAsync({
          seasonId: editingSeasonId,
          updates: {
            name,
            start_date: startDate,
            end_date: endDate,
            is_current: isCurrent,
            status,
          },
        })
      } else {
        // Create new season
        await createSeason.mutateAsync({
          name,
          start_date: startDate,
          end_date: endDate,
          is_current: isCurrent,
          status,
          club_id: profile.club_id,
        })
      }

      // Reset form
      setName('')
      setStartDate('')
      setEndDate('')
      setIsCurrent(false)
      setStatus('draft')
      setShowCreateForm(false)
      setEditingSeasonId(null)
    } catch (err) {
      console.error('Error saving season:', err)
      setError(err instanceof Error ? err.message : 'Failed to save season')
    }
  }

  function handleEdit(season: any) {
    setEditingSeasonId(season.id)
    setName(season.name)
    setStartDate(season.start_date)
    setEndDate(season.end_date)
    setIsCurrent(season.is_current)
    setStatus(season.status)
    setShowCreateForm(true)
  }

  function handleCancelEdit() {
    setEditingSeasonId(null)
    setName('')
    setStartDate('')
    setEndDate('')
    setIsCurrent(false)
    setStatus('draft')
    setShowCreateForm(false)
  }

  async function handleSetCurrent(seasonId: string) {
    if (!profile?.club_id) {
      setError('No club associated with your account')
      return
    }

    setError(null)

    try {
      // Get the season to check its status
      const season = seasons.find(s => s.id === seasonId)
      
      // If the season is active, ensure all programs are activated
      if (season?.status === 'active') {
        await handleStatusChange(seasonId, 'active')
      }

      await updateSeason.mutateAsync({
        seasonId,
        updates: { is_current: true },
      })

      // Force a full page refresh to clear cached season selection
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedSeasonId')
      }
      window.location.reload()
    } catch (err) {
      console.error('Error setting current season:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to set current season'
      )
    }
  }

  async function handleStatusChange(seasonId: string, newStatus: string) {
    setError(null)

    try {
      // If activating a season, also activate all its programs, sub-programs, and groups
      if (newStatus === 'active') {
        // 1. Activate all programs in this season
        const { error: programsError } = await supabase
          .from('programs')
          .update({ status: 'ACTIVE' })
          .eq('season_id', seasonId)
          .eq('club_id', profile?.club_id)

        if (programsError) {
          console.error('Error activating programs:', programsError)
          setError('Failed to activate programs for this season')
          return
        }

        // 2. Activate all sub-programs in this season
        const { error: subProgramsError } = await supabase
          .from('sub_programs')
          .update({ status: 'ACTIVE' })
          .eq('season_id', seasonId)
          .eq('club_id', profile?.club_id)

        if (subProgramsError) {
          console.error('Error activating sub-programs:', subProgramsError)
          setError('Failed to activate sub-programs for this season')
          return
        }

        // 3. Activate all groups in this season
        // Note: groups don't have season_id, need to join through sub_programs
        const { data: subPrograms } = await supabase
          .from('sub_programs')
          .select('id')
          .eq('season_id', seasonId)
          .eq('club_id', profile?.club_id)

        if (subPrograms && subPrograms.length > 0) {
          const subProgramIds = subPrograms.map(sp => sp.id)
          const { error: groupsError } = await supabase
            .from('groups')
            .update({ status: 'ACTIVE' })
            .in('sub_program_id', subProgramIds)
            .eq('club_id', profile?.club_id)

          if (groupsError) {
            console.error('Error activating groups:', groupsError)
            setError('Failed to activate groups for this season')
            return
          }
        }
      }

      // If setting to draft, deactivate all programs (hide from parents)
      if (newStatus === 'draft') {
        // 1. Deactivate all programs in this season
        const { error: programsError } = await supabase
          .from('programs')
          .update({ status: 'INACTIVE' })
          .eq('season_id', seasonId)
          .eq('club_id', profile?.club_id)

        if (programsError) {
          console.error('Error deactivating programs:', programsError)
          setError('Failed to deactivate programs for this season')
          return
        }

        // 2. Deactivate all sub-programs in this season
        const { error: subProgramsError } = await supabase
          .from('sub_programs')
          .update({ status: 'INACTIVE' })
          .eq('season_id', seasonId)
          .eq('club_id', profile?.club_id)

        if (subProgramsError) {
          console.error('Error deactivating sub-programs:', subProgramsError)
          setError('Failed to deactivate sub-programs for this season')
          return
        }

        // 3. Deactivate all groups in this season
        const { data: subPrograms } = await supabase
          .from('sub_programs')
          .select('id')
          .eq('season_id', seasonId)
          .eq('club_id', profile?.club_id)

        if (subPrograms && subPrograms.length > 0) {
          const subProgramIds = subPrograms.map(sp => sp.id)
          const { error: groupsError } = await supabase
            .from('groups')
            .update({ status: 'INACTIVE' })
            .in('sub_program_id', subProgramIds)
            .eq('club_id', profile?.club_id)

          if (groupsError) {
            console.error('Error deactivating groups:', groupsError)
            setError('Failed to deactivate groups for this season')
            return
          }
        }
      }

      // Update the season status
      await updateSeason.mutateAsync({
        seasonId,
        updates: { status: newStatus },
      })
    } catch (err) {
      console.error('Error updating season status:', err)
      setError(err instanceof Error ? err.message : 'Failed to update season status')
    }
  }

  async function handleArchive(seasonId: string) {
    if (!confirm('Are you sure you want to archive this season?')) {
      return
    }

    await handleStatusChange(seasonId, 'archived')
  }

  // Clone season functionality (complex - keeps existing logic for now)
  async function handleCloneSeason(sourceSeasonId: string) {
    if (!profile?.club_id) {
      setError('No club associated with your account')
      return
    }

    const sourceSeason = seasons.find((s) => s.id === sourceSeasonId)
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
    setError(null)

    try {
      // 1. Create new season
      const sourceStart = new Date(sourceSeason.start_date)
      const sourceEnd = new Date(sourceSeason.end_date)
      const currentYear = new Date().getFullYear()

      const newStartDate = new Date(
        currentYear,
        sourceStart.getMonth(),
        sourceStart.getDate()
      )
      const newEndDate = new Date(
        currentYear + 1,
        sourceEnd.getMonth(),
        sourceEnd.getDate()
      )

      // PHASE 2: Use seasonsService instead of clubQuery
      const { data: newSeason, error: seasonError } = await supabase
        .from('seasons')
        .insert([
          {
            name: newSeasonName,
            start_date: newStartDate.toISOString().split('T')[0],
            end_date: newEndDate.toISOString().split('T')[0],
            is_current: false,
            status: 'draft',
            club_id: profile.club_id,
          },
        ])
        .select()
        .single()

      if (seasonError || !newSeason) {
        setError(seasonError?.message || 'Failed to create new season')
        setCloningSeasonId(null)
        return
      }

      // 2. Fetch all programs from source season - RLS handles filtering
      const { data: sourcePrograms, error: programsError } = await supabase
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
            groups (
              id,
              name,
              status
            )
          )
        `)
        .eq('season_id', sourceSeasonId)

      if (programsError) {
        setError(`Failed to load programs: ${programsError.message}`)
        setCloningSeasonId(null)
        return
      }

      // 3. Clone programs and sub-programs - RLS handles filtering
      for (const program of sourcePrograms || []) {
        const { data: newProgram, error: programError } = await supabase
          .from('programs')
          .insert([
            {
              name: program.name,
              description: program.description,
              status: ProgramStatus.ACTIVE, // Changed: Set to ACTIVE so they're immediately visible
              season_id: newSeason.id,
              club_id: profile.club_id,
            },
          ])
          .select()
          .single()

        if (programError || !newProgram) {
          console.error('Error cloning program:', program.name, programError)
          continue
        }

        // Clone sub-programs and their groups
        if (program.sub_programs && program.sub_programs.length > 0) {
          for (const sp of program.sub_programs) {
            const { data: newSubProgram, error: subProgramError } =
              await supabase
                .from('sub_programs')
                .insert([
                  {
                    program_id: newProgram.id,
                    name: sp.name,
                    description: sp.description,
                    status: ProgramStatus.ACTIVE, // Changed: Set to ACTIVE so they're immediately visible
                    registration_fee: sp.registration_fee || null,
                    max_capacity: sp.max_capacity || null,
                    season_id: newSeason.id,
                    club_id: profile.club_id,
                  },
                ])
                .select()
                .single()

            if (subProgramError || !newSubProgram) {
              console.error(
                'Error cloning sub-program:',
                sp.name,
                subProgramError
              )
              continue
            }

            // Clone groups
            if (sp.groups && sp.groups.length > 0) {
              const groupsToInsert = sp.groups.map((group: any) => ({
                sub_program_id: newSubProgram.id,
                name: group.name,
                status: ProgramStatus.ACTIVE, // Changed: Set to ACTIVE so they're immediately visible
                club_id: profile.club_id,
              }))

              const { error: groupsError } = await supabase
                .from('groups')
                .insert(groupsToInsert)

              if (groupsError) {
                console.error(
                  'Error cloning groups for sub-program:',
                  sp.name,
                  groupsError
                )
              }
            }
          }
        }
      }

      const totalSubPrograms =
        sourcePrograms?.reduce(
          (sum: number, p: any) => sum + (p.sub_programs?.length || 0),
          0
        ) || 0
      const totalGroups =
        sourcePrograms?.reduce(
          (sum: number, p: any) =>
            sum +
            (p.sub_programs?.reduce(
              (spSum: number, sp: any) => spSum + (sp.groups?.length || 0),
              0
            ) || 0),
          0
        ) || 0

      // Invalidate queries
      window.location.reload()

      alert(
        `Successfully cloned from ${sourceSeason.name} to ${newSeasonName}:\n` +
          `- ${sourcePrograms?.length || 0} programs\n` +
          `- ${totalSubPrograms} sub-programs\n` +
          `- ${totalGroups} groups\n\n` +
          `All items are set to ACTIVE and ready for registration.`
      )
    } catch (err) {
      console.error('Error cloning season:', err)
      setError('Failed to clone season')
    } finally {
      setCloningSeasonId(null)
    }
  }

  const isLoading = authLoading || seasonsLoading

  // Show loading state
  // Auth check ensures profile exists (only after auth is done)
  if (!authLoading && !profile) {
    return null
  }

  const activeSeasons = seasons.filter((s) => s.status !== 'archived')
  const archivedSeasons = seasons.filter((s) => s.status === 'archived')

  const loading =
    createSeason.isPending ||
    updateSeason.isPending ||
    deleteSeason.isPending

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Seasons"
          description="Manage seasons for your club. Programs and registrations are scoped to seasons."
        />
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
            <CardTitle>{editingSeasonId ? 'Edit Season' : 'Create New Season'}</CardTitle>
            <CardDescription>
              {editingSeasonId 
                ? 'Update season details, status, and current season flag.'
                : 'Create a new season for your club. You can set it as the current season.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Season Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                    onChange={(e) => setStartDate(e.target.value)}
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
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Season Flags
                  </label>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <input
                        id="isCurrent"
                        type="checkbox"
                        checked={isCurrent}
                        onChange={(e) => setIsCurrent(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 mt-0.5"
                      />
                      <div>
                        <label htmlFor="isCurrent" className="text-sm font-medium text-slate-900">
                          Current Season
                        </label>
                        <p className="text-xs text-slate-600 mt-0.5">
                          The season displayed by default in the UI. Only one per club.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1.5">
                        Status
                      </label>
                      <select
                        value={status}
                        onChange={(e) =>
                          setStatus(
                            e.target.value as 'draft' | 'active' | 'closed' | 'archived'
                          )
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="draft">Draft - Setting up, not visible to parents</option>
                        <option value="active">Active - Open for registrations</option>
                        <option value="closed">Closed - No new registrations</option>
                        <option value="archived">Archived - Historical data only</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading 
                    ? (editingSeasonId ? 'Saving…' : 'Creating…')
                    : (editingSeasonId ? 'Save Changes' : 'Create Season')
                  }
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
              {activeSeasons.map((season) => (
                <div
                  key={season.id}
                  className="flex items-center justify-between border rounded-lg p-4"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {season.name}
                        </h3>
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
                              : season.status === 'closed'
                              ? 'bg-orange-100 text-orange-800'
                              : season.status === 'draft'
                              ? 'bg-slate-100 text-slate-800'
                              : 'bg-purple-100 text-purple-800'
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
                        title="Set as the current season shown by default"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Make Current
                      </Button>
                    )}
                    {season.status === 'active' && !season.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(season.id, 'closed')}
                        disabled={loading}
                        title="Close registrations but keep data accessible"
                      >
                        <Lock className="h-4 w-4 mr-1" />
                        Close
                      </Button>
                    )}
                    {season.status === 'closed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(season.id, 'active')}
                        disabled={loading}
                        title="Reopen for registrations"
                      >
                        <Unlock className="h-4 w-4 mr-1" />
                        Reopen
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(season)}
                      disabled={loading}
                      title="Edit season details"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
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
                    {!season.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(season.id)}
                        disabled={loading}
                        title="Archive this season (cannot be undone easily)"
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        Archive
                      </Button>
                    )}
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
            <CardDescription>
              Past seasons that are no longer active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {archivedSeasons.map((season) => (
                <div
                  key={season.id}
                  className="flex items-center justify-between border rounded-lg p-4 opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {season.name}
                      </h3>
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


