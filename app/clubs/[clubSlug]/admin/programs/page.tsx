'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { ProgramStatus } from '@/lib/programStatus'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Zap, AlertTriangle } from 'lucide-react'
import { useRequireAdmin } from '@/lib/auth-context'
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { usePrograms } from '@/lib/hooks/use-programs'
import { AdminPageHeader } from '@/components/admin-page-header'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

type Program = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus | null
}

type SubProgram = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus
  program_id: string
}

type ProgramWithSubPrograms = Program & {
  sub_programs: SubProgram[]
}

export default function ProgramsPage() {
  const router = useRouter()
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, loading: authLoading } = useRequireAdmin()
  const selectedSeason = useSelectedSeason()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingSubProgramId, setDeletingSubProgramId] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [programToDelete, setProgramToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteCounts, setDeleteCounts] = useState<{
    athletes: number
    coaches: number
    subPrograms: number
    groups: number
  } | null>(null)
  const [loadingCounts, setLoadingCounts] = useState(false)

  // PHASE 2: RLS handles club filtering automatically - no clubQuery needed!
  // React Query handles loading, error, and caching
  const {
    data: allPrograms = [],
    isLoading,
    refetch,
    error,
  } = usePrograms(selectedSeason?.id, true) // Include sub_programs, RLS filters by club

  // #region agent log
  useEffect(() => {
    if (selectedSeason && !isLoading) {
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'programs/page:PROGRAMS_RENDER',message:'Programs list rendered',data:{seasonId:selectedSeason.id,programCount:allPrograms.length,programNames:allPrograms.map((p:any)=>p.name)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'CACHE'})}).catch(()=>{});
    }
  }, [allPrograms, selectedSeason, isLoading])
  // #endregion

  // Admin view: Show ALL programs and sub-programs regardless of status
  // (Parent portal filters by status, but admins need to see everything to manage)
  const programs = allPrograms as ProgramWithSubPrograms[]

  async function handleDeleteClick(programId: string) {
    const program = programs.find(p => p.id === programId)
    if (!program) return

    setProgramToDelete({ id: programId, name: program.name })
    setDeleteConfirmText('')
    setLoadingCounts(true)
    setDeleteDialogOpen(true)

    // Fetch counts of athletes, coaches, sub-programs, and groups
    try {
      const [athletesResult, coachesResult, subProgramsResult, groupsResult] = await Promise.all([
        // Count athletes with registrations for this program's sub-programs
        supabase
          .from('registrations')
          .select('athlete_id', { count: 'exact', head: true })
          .in('sub_program_id', program.sub_programs?.map(sp => sp.id) || [])
          .eq('season_id', selectedSeason?.id || '')
          .is('deleted_at', null),
        
        // Count coaches assigned to this program's sub-programs
        supabase
          .from('coach_assignments')
          .select('coach_id', { count: 'exact', head: true })
          .in('sub_program_id', program.sub_programs?.map(sp => sp.id) || [])
          .eq('season_id', selectedSeason?.id || ''),
        
        // Count sub-programs
        supabase
          .from('sub_programs')
          .select('id', { count: 'exact', head: true })
          .eq('program_id', programId)
          .is('deleted_at', null),
        
        // Count groups
        supabase
          .from('groups')
          .select('id', { count: 'exact', head: true })
          .in('sub_program_id', program.sub_programs?.map(sp => sp.id) || [])
          .is('deleted_at', null),
      ])

      setDeleteCounts({
        athletes: athletesResult.count || 0,
        coaches: coachesResult.count || 0,
        subPrograms: subProgramsResult.count || 0,
        groups: groupsResult.count || 0,
      })
    } catch (error) {
      console.error('Error fetching delete counts:', error)
      setDeleteCounts({ athletes: 0, coaches: 0, subPrograms: 0, groups: 0 })
    } finally {
      setLoadingCounts(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!programToDelete || deleteConfirmText !== 'DELETE') return

    setDeletingId(programToDelete.id)
    setDeleteDialogOpen(false)

    const { error } = await supabase.rpc('soft_delete_program', {
      program_id: programToDelete.id,
    })

    if (error) {
      console.error('Error soft deleting program:', error)
      alert(`Error deleting program: ${error.message}`)
    } else {
      // Refetch programs list immediately to show updated data
      await refetch()
    }

    setDeletingId(null)
    setProgramToDelete(null)
    setDeleteConfirmText('')
    setDeleteCounts(null)
  }

  async function handleDeleteSubProgram(subProgramId: string, programId: string) {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this sub-program? This will also delete all its groups. You cannot undo this from the UI.'
    )

    if (!confirmDelete) return

    setDeletingSubProgramId(subProgramId)

    const { error } = await supabase.rpc('soft_delete_sub_program', {
      sub_program_id: subProgramId,
    })

    if (error) {
      console.error('Error soft deleting sub-program:', error)
      alert(`Error deleting sub-program: ${error.message}`)
    } else {
      // Refetch programs list immediately to show updated data
      await refetch()
    }

    setDeletingSubProgramId(null)
  }

  async function handleActivateAll(programId: string) {
    const program = programs.find(p => p.id === programId)
    if (!program) return

    const confirmActivate = window.confirm(
      `Activate "${program.name}" and all its sub-programs and groups?\n\nThis will set the program, all sub-programs, and all groups to ACTIVE status.`
    )

    if (!confirmActivate) return

    setActivatingId(programId)

    try {
      // Get all sub-program IDs for this program
      const subProgramIds = (program.sub_programs || []).map(sp => sp.id)

      if (subProgramIds.length === 0) {
        alert('No sub-programs found for this program.')
        setActivatingId(null)
        return
      }

      // 1. Activate the parent program first
      const { error: programError } = await supabase
        .from('programs')
        .update({ status: ProgramStatus.ACTIVE })
        .eq('id', programId)

      if (programError) {
        console.error('Error activating program:', programError)
        alert(`Error activating program: ${programError.message}`)
        setActivatingId(null)
        return
      }

      // 2. Activate all sub-programs
      const { error: subProgramError } = await supabase
        .from('sub_programs')
        .update({ status: ProgramStatus.ACTIVE })
        .eq('program_id', programId)

      if (subProgramError) {
        console.error('Error activating sub-programs:', subProgramError)
        alert(`Error activating sub-programs: ${subProgramError.message}`)
        setActivatingId(null)
        return
      }

      // 2. Activate all groups for these sub-programs
      const { error: groupsError } = await supabase
        .from('groups')
        .update({ status: ProgramStatus.ACTIVE })
        .in('sub_program_id', subProgramIds)

      if (groupsError) {
        console.error('Error activating groups:', groupsError)
        alert(`Error activating groups: ${groupsError.message}`)
      } else {
        alert(`✅ "${program.name}" and all its sub-programs and groups are now ACTIVE!`)
      }

      // Refetch programs list immediately to show updated status
      await refetch()
    } catch (err) {
      console.error('Error activating program contents:', err)
      alert('An unexpected error occurred.')
    }

    setActivatingId(null)
  }

  // Show loading state
  if (authLoading || isLoading) {
    return <InlineLoading message="Loading programs…" />
  }

  // Show error state
  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />
  }

  // Auth check ensures profile exists, but TypeScript needs this
  if (!profile) {
    return null
  }

  // Base path for club-aware routes
  const basePath = `/clubs/${clubSlug}/admin`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Programs"
          description="Manage all ski programs, including soft-deleting them."
        />
        <Link href={`${basePath}/programs/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Program
          </Button>
        </Link>
      </div>


      <Card>
        <CardHeader>
          <CardTitle>Programs</CardTitle>
          <CardDescription>
            All ski programs for {selectedSeason?.name || 'the selected season'} with their sub-programs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No programs yet. Click &quot;Add Program&quot; to create
              one.
            </div>
          ) : (
            <div className="space-y-6">
              {programs.map(program => (
                <div
                  key={program.id}
                  className="border rounded-lg p-4 space-y-4"
                >
                  {/* Program Header */}
                  <div className="flex items-start justify-between border-b pb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {program.name}
                        </h3>
                        {program.status === ProgramStatus.INACTIVE && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                            Inactive
                          </span>
                        )}
                      </div>
                      {program.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {program.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5 ml-4">
                      <Link href={`${basePath}/programs/${program.id}/edit`}>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link
                        href={`${basePath}/programs/${program.id}/sub-programs/new`}
                      >
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleActivateAll(program.id)}
                        disabled={activatingId === program.id}
                        title="Activate all sub-programs and groups"
                      >
                        <Zap className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteClick(program.id)}
                        disabled={deletingId === program.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Sub-programs */}
                  {program.sub_programs && program.sub_programs.length > 0 ? (
                    <div className="pl-4 space-y-3">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">
                        Sub-programs:
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {program.sub_programs.map(subProgram => (
                          <div
                            key={subProgram.id}
                            className="border rounded-md p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <h5 className="font-medium text-slate-900 text-sm truncate">
                                    {subProgram.name}
                                  </h5>
                                  {subProgram.status === ProgramStatus.INACTIVE && (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 flex-shrink-0">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                {subProgram.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {subProgram.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Link
                                  href={`${basePath}/sub-programs/${subProgram.id}/edit`}
                                >
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </Link>
                                <Link
                                  href={`${basePath}/sub-programs/${subProgram.id}/groups/new`}
                                >
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    title="Add new group"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() =>
                                    handleDeleteSubProgram(
                                      subProgram.id,
                                      program.id
                                    )
                                  }
                                  disabled={
                                    deletingSubProgramId === subProgram.id
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
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
                          href={`${basePath}/programs/${program.id}/sub-programs/new`}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Program
            </DialogTitle>
            <DialogDescription>
              You are about to delete <strong>{programToDelete?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {loadingCounts ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-600 rounded-full" />
              </div>
            ) : deleteCounts && (
              <>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">
                    ⚠️ This action will affect:
                  </p>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• {deleteCounts.subPrograms} sub-program(s)</li>
                    <li>• {deleteCounts.groups} group(s)</li>
                    <li>• {deleteCounts.athletes} athlete registration(s)</li>
                    <li>• {deleteCounts.coaches} coach assignment(s)</li>
                  </ul>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm font-semibold text-red-900 mb-2">
                    🚨 Soft Delete: Data remains in database
                  </p>
                  <p className="text-sm text-red-800">
                    This program will be hidden from the admin portal but data remains in the database for audit/recovery purposes. 
                    All relationships with athletes, coaches, sub-programs, and groups will be preserved.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Type DELETE"
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setProgramToDelete(null)
                setDeleteConfirmText('')
                setDeleteCounts(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmText !== 'DELETE' || loadingCounts}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


