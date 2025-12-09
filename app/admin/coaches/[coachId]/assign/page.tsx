'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAdminClub } from '@/lib/use-admin-club'
import { useAdminSeason } from '@/lib/use-admin-season'
import { clubQuery } from '@/lib/supabase-helpers'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Program {
  id: string
  name: string
  sub_programs?: SubProgram[]
}

interface SubProgram {
  id: string
  name: string
  program_id: string
  groups?: Group[]
}

interface Group {
  id: string
  name: string
  sub_program_id: string
}

interface CoachAssignment {
  id: string
  program_id?: string
  sub_program_id?: string
  group_id?: string
  role?: string
}

type CoachRole = 'head_coach' | 'assistant_coach' | 'substitute_coach'

const COACH_ROLES: { value: CoachRole; label: string }[] = [
  { value: 'head_coach', label: 'Head Coach' },
  { value: 'assistant_coach', label: 'Assistant Coach' },
  { value: 'substitute_coach', label: 'Substitute Coach' },
]

export default function AssignCoachPage() {
  const params = useParams()
  const router = useRouter()
  const coachId = params.coachId as string
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const { selectedSeason, loading: seasonLoading } = useAdminSeason()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coach, setCoach] = useState<{ first_name?: string; last_name?: string } | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [existingAssignments, setExistingAssignments] = useState<CoachAssignment[]>([])
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set())
  // Map of assignment key -> role
  const [assignmentRoles, setAssignmentRoles] = useState<Map<string, CoachRole>>(new Map())

  useEffect(() => {
    async function loadData() {
      if (authLoading || seasonLoading || !clubId || !selectedSeason) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      try {
        // Load coach info
        const { data: coachData, error: coachError } = await clubQuery(
          supabase
            .from('coaches')
            .select('first_name, last_name')
            .eq('id', coachId)
            .single(),
          clubId
        )

        if (coachError || !coachData) {
          setError('Coach not found')
          setLoading(false)
          return
        }

        setCoach(coachData)

        // Load programs with sub-programs and groups (hierarchical)
        const { data: programsData, error: programsError } = await clubQuery(
          supabase
            .from('programs')
            .select(`
              id,
              name,
              sub_programs (
                id,
                name,
                program_id,
                groups (
                  id,
                  name,
                  sub_program_id
                )
              )
            `)
            .order('name', { ascending: true }),
          clubId
        )

        if (programsError) {
          setError(programsError.message)
          setLoading(false)
          return
        }

        setPrograms(programsData || [])

        // Load existing assignments for this coach
        const { data: assignmentsData, error: assignmentsError } = await clubQuery(
          supabase
            .from('coach_assignments')
            .select('id, program_id, sub_program_id, group_id, role')
            .eq('coach_id', coachId)
            .eq('season_id', selectedSeason.id),
          clubId
        )

        if (assignmentsError) {
          console.error('Error loading assignments:', {
            error: assignmentsError,
            message: assignmentsError.message,
            details: assignmentsError.details,
            hint: assignmentsError.hint,
          })
          // Don't block the UI if assignments fail to load - just start with empty assignments
          setExistingAssignments([])
        } else {
          setExistingAssignments(assignmentsData || [])
          // Pre-select existing assignments and their roles
          const selected = new Set<string>()
          const roles = new Map<string, CoachRole>()
          assignmentsData?.forEach((assignment: CoachAssignment) => {
            let key: string
            if (assignment.group_id) {
              key = `group_${assignment.group_id}`
            } else if (assignment.sub_program_id) {
              key = `subprogram_${assignment.sub_program_id}`
            } else if (assignment.program_id) {
              key = `program_${assignment.program_id}`
            } else {
              return
            }
            selected.add(key)
            roles.set(key, (assignment.role || 'assistant_coach') as CoachRole)
          })
          setSelectedAssignments(selected)
          setAssignmentRoles(roles)
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [clubId, coachId, authLoading, authError, selectedSeason, seasonLoading])

  const toggleAssignment = (key: string) => {
    const newSelected = new Set(selectedAssignments)
    if (newSelected.has(key)) {
      newSelected.delete(key)
      // Remove role when unchecking
      const newRoles = new Map(assignmentRoles)
      newRoles.delete(key)
      setAssignmentRoles(newRoles)
    } else {
      newSelected.add(key)
      // Set default role when checking
      const newRoles = new Map(assignmentRoles)
      newRoles.set(key, 'assistant_coach')
      setAssignmentRoles(newRoles)
    }
    setSelectedAssignments(newSelected)
  }

  const setAssignmentRole = (key: string, role: CoachRole) => {
    const newRoles = new Map(assignmentRoles)
    newRoles.set(key, role)
    setAssignmentRoles(newRoles)
  }

  const getRoleLabel = (role: CoachRole): string => {
    return COACH_ROLES.find(r => r.value === role)?.label || role
  }

  const getAssignmentDisplayName = (program: Program, subProgram?: SubProgram, group?: Group): string => {
    if (group) return group.name
    if (subProgram) return subProgram.name
    return program.name
  }

  async function handleSave() {
    if (!clubId || !selectedSeason) {
      setError('Missing club or season information')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Delete existing assignments for this coach/season
      const { error: deleteError } = await clubQuery(
        supabase
          .from('coach_assignments')
          .delete()
          .eq('coach_id', coachId)
          .eq('season_id', selectedSeason.id),
        clubId
      )

      if (deleteError) {
        throw deleteError
      }

      // Create new assignments from selected items
      const assignmentsToCreate: Array<{
        coach_id: string
        club_id: string
        season_id: string
        program_id?: string
        sub_program_id?: string
        group_id?: string
        role: CoachRole
      }> = []

      selectedAssignments.forEach((key) => {
        const [type, id] = key.split('_')
        const role = assignmentRoles.get(key) || 'assistant_coach'
        const assignment: any = {
          coach_id: coachId,
          club_id: clubId,
          season_id: selectedSeason.id,
          role,
        }

        if (type === 'program') {
          assignment.program_id = id
        } else if (type === 'subprogram') {
          assignment.sub_program_id = id
        } else if (type === 'group') {
          assignment.group_id = id
        }

        assignmentsToCreate.push(assignment)
      })

      if (assignmentsToCreate.length > 0) {
        const { error: insertError } = await clubQuery(
          supabase.from('coach_assignments').insert(assignmentsToCreate),
          clubId
        )

        if (insertError) {
          throw insertError
        }
      }

      router.push('/admin/coaches')
    } catch (err) {
      console.error('Error saving assignments:', err)
      setError(err instanceof Error ? err.message : 'Failed to save assignments')
      setSaving(false)
    }
  }

  if (authLoading || seasonLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || authError}</p>
          <Button asChild variant="outline">
            <Link href="/admin/coaches">Back to Coaches</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/coaches">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Assign Coach: {coach?.first_name} {coach?.last_name}
          </h1>
          <p className="text-muted-foreground">
            Select programs, sub-programs, or groups for {selectedSeason?.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>
            Check the boxes to assign this coach to programs, sub-programs, or groups.
            Select the role (Head Coach, Assistant Coach, or Substitute Coach) for each assignment.
            You can assign at any level - program-wide, sub-program specific, or group specific.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No programs found. Create programs first before assigning coaches.
            </p>
          ) : (
            <div className="space-y-6">
              {programs.map((program) => (
                <div key={program.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Checkbox
                      id={`program_${program.id}`}
                      checked={selectedAssignments.has(`program_${program.id}`)}
                      onCheckedChange={() => toggleAssignment(`program_${program.id}`)}
                    />
                    <Label
                      htmlFor={`program_${program.id}`}
                      className="text-lg font-semibold cursor-pointer flex-1"
                    >
                      {program.name}
                    </Label>
                    {selectedAssignments.has(`program_${program.id}`) && (
                      <Select
                        value={assignmentRoles.get(`program_${program.id}`) || 'assistant_coach'}
                        onValueChange={(value) => setAssignmentRole(`program_${program.id}`, value as CoachRole)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COACH_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                      {program.sub_programs && program.sub_programs.length > 0 && (
                    <div className="ml-6 space-y-3">
                      {program.sub_programs.map((subProgram) => (
                        <div key={subProgram.id} className="border-l-2 pl-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Checkbox
                              id={`subprogram_${subProgram.id}`}
                              checked={selectedAssignments.has(`subprogram_${subProgram.id}`)}
                              onCheckedChange={() => toggleAssignment(`subprogram_${subProgram.id}`)}
                            />
                            <Label
                              htmlFor={`subprogram_${subProgram.id}`}
                              className="font-medium cursor-pointer flex-1"
                            >
                              {subProgram.name}
                            </Label>
                            {selectedAssignments.has(`subprogram_${subProgram.id}`) && (
                              <Select
                                value={assignmentRoles.get(`subprogram_${subProgram.id}`) || 'assistant_coach'}
                                onValueChange={(value) => setAssignmentRole(`subprogram_${subProgram.id}`, value as CoachRole)}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COACH_ROLES.map((role) => (
                                    <SelectItem key={role.value} value={role.value}>
                                      {role.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          {subProgram.groups && subProgram.groups.length > 0 && (
                            <div className="ml-6 space-y-2">
                              {subProgram.groups.map((group) => (
                                <div key={group.id} className="flex items-center gap-3">
                                  <Checkbox
                                    id={`group_${group.id}`}
                                    checked={selectedAssignments.has(`group_${group.id}`)}
                                    onCheckedChange={() => toggleAssignment(`group_${group.id}`)}
                                  />
                                  <Label
                                    htmlFor={`group_${group.id}`}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    {group.name}
                                  </Label>
                                  {selectedAssignments.has(`group_${group.id}`) && (
                                    <Select
                                      value={assignmentRoles.get(`group_${group.id}`) || 'assistant_coach'}
                                      onValueChange={(value) => setAssignmentRole(`group_${group.id}`, value as CoachRole)}
                                    >
                                      <SelectTrigger className="w-48">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {COACH_ROLES.map((role) => (
                                          <SelectItem key={role.value} value={role.value}>
                                            {role.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Assignments'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/coaches">Cancel</Link>
        </Button>
      </div>
    </div>
  )
}
