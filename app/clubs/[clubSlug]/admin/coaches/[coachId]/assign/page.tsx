'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRequireAdmin } from '@/lib/auth-context'
import { useSeason } from '@/lib/hooks/use-season'
import { useCoaches } from '@/lib/hooks/use-coaches'
import { usePrograms } from '@/lib/hooks/use-programs'
import { coachAssignmentsService } from '@/lib/services/coach-assignments-service'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

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
  const params = useParams() as { clubSlug?: string; coachId?: string }
  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const coachId = params.coachId as string

  const { profile, loading: authLoading } = useRequireAdmin()
  const { selectedSeason, loading: seasonLoading } = useSeason()

  // PHASE 2: RLS handles club filtering automatically
  const {
    data: coaches = [],
    isLoading: coachesLoading,
    error: coachesError,
  } = useCoaches(true) // Include assignments

  const {
    data: programs = [],
    isLoading: programsLoading,
    error: programsError,
  } = usePrograms(selectedSeason?.id, true) // Include sub-programs

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingAssignments, setExistingAssignments] = useState<
    CoachAssignment[]
  >([])
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(
    new Set()
  )
  // Map of assignment key -> role
  const [assignmentRoles, setAssignmentRoles] = useState<
    Map<string, CoachRole>
  >(new Map())

  // Find the coach
  const coach = coaches.find((c: any) => c.id === coachId)

  // Load existing assignments
  useEffect(() => {
    async function loadAssignments() {
      if (
        authLoading ||
        seasonLoading ||
        coachesLoading ||
        programsLoading ||
        !selectedSeason ||
        !coach
      ) {
        return
      }

      try {
        setLoading(true)
        setError(null)

        // PHASE 2: RLS handles club filtering automatically
        const result = await coachAssignmentsService.getAssignmentsByCoach(
          coachId,
          selectedSeason.id
        )

        if (result.error) {
          console.error('Error loading assignments:', result.error)
          setExistingAssignments([])
        } else {
          setExistingAssignments(result.data || [])
          // Pre-select existing assignments and their roles
          const selected = new Set<string>()
          const roles = new Map<string, CoachRole>()
          ;(result.data || []).forEach((assignment: CoachAssignment) => {
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
            roles.set(
              key,
              (assignment.role || 'assistant_coach') as CoachRole
            )
          })
          setSelectedAssignments(selected)
          setAssignmentRoles(roles)
        }
      } catch (err) {
        console.error('Error loading assignments:', err)
        setError('Failed to load assignments')
      } finally {
        setLoading(false)
      }
    }

    loadAssignments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coachId,
    selectedSeason?.id,
    coach?.id,
    authLoading,
    seasonLoading,
    coachesLoading,
    programsLoading,
  ])

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

  async function handleSave() {
    if (!profile?.club_id || !selectedSeason) {
      setError('Missing club or season information')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Build assignments array
      const assignmentsToCreate: Array<{
        program_id?: string
        sub_program_id?: string
        group_id?: string
        role: string
      }> = []

      selectedAssignments.forEach((key) => {
        const [type, id] = key.split('_')
        const role = assignmentRoles.get(key) || 'assistant_coach'
        const assignment: any = {
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

      // PHASE 2: RLS ensures user can only manage assignments in their club
      const result = await coachAssignmentsService.saveAssignments(
        coachId,
        selectedSeason.id,
        profile.club_id,
        assignmentsToCreate
      )

      if (result.error) {
        throw result.error
      }

      router.push(`${basePath}/coaches`)
    } catch (err) {
      console.error('Error saving assignments:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to save assignments'
      )
      setSaving(false)
    }
  }

  const isLoading =
    authLoading ||
    seasonLoading ||
    coachesLoading ||
    programsLoading ||
    loading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading coach assignments…" />
  }

  // Show error state
  if (coachesError || programsError) {
    return (
      <ErrorState
        error={coachesError || programsError}
        onRetry={() => router.refresh()}
      />
    )
  }

  // Show message if coach not found
  if (!coach) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Coach Not Found</CardTitle>
            <CardDescription>
              The coach you're looking for doesn't exist or you don't have
              access to them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push(`${basePath}/coaches`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Coaches
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Auth check ensures profile exists
  if (!profile || !selectedSeason) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push(`${basePath}/coaches`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Coaches
        </Button>
        <h1 className="text-3xl font-bold">
          Assign {coach.first_name} {coach.last_name}
        </h1>
        <p className="text-muted-foreground">
          Assign this coach to programs, sub-programs, or groups for{' '}
          {selectedSeason.name}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Assignments</CardTitle>
          <CardDescription>
            Choose which programs, sub-programs, or groups this coach will be
            assigned to
          </CardDescription>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No programs available for the selected season
            </p>
          ) : (
            <div className="space-y-6">
              {programs.map((program: Program) => (
                <div key={program.id} className="border rounded-lg p-4">
                  <div className="space-y-3">
                    {/* Program level */}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`program_${program.id}`}
                        checked={selectedAssignments.has(`program_${program.id}`)}
                        onCheckedChange={() =>
                          toggleAssignment(`program_${program.id}`)
                        }
                      />
                      <Label
                        htmlFor={`program_${program.id}`}
                        className="font-semibold cursor-pointer"
                      >
                        {program.name} (Program)
                      </Label>
                      {selectedAssignments.has(`program_${program.id}`) && (
                        <Select
                          value={
                            assignmentRoles.get(`program_${program.id}`) ||
                            'assistant_coach'
                          }
                          onValueChange={(value) =>
                            setAssignmentRole(
                              `program_${program.id}`,
                              value as CoachRole
                            )
                          }
                        >
                          <SelectTrigger className="w-40">
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

                    {/* Sub-programs */}
                    {program.sub_programs &&
                      program.sub_programs.length > 0 &&
                      program.sub_programs.map((subProgram: SubProgram) => (
                        <div
                          key={subProgram.id}
                          className="ml-8 space-y-2 border-l-2 pl-4"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`subprogram_${subProgram.id}`}
                              checked={selectedAssignments.has(
                                `subprogram_${subProgram.id}`
                              )}
                              onCheckedChange={() =>
                                toggleAssignment(`subprogram_${subProgram.id}`)
                              }
                            />
                            <Label
                              htmlFor={`subprogram_${subProgram.id}`}
                              className="cursor-pointer"
                            >
                              {subProgram.name} (Sub-Program)
                            </Label>
                            {selectedAssignments.has(
                              `subprogram_${subProgram.id}`
                            ) && (
                              <Select
                                value={
                                  assignmentRoles.get(
                                    `subprogram_${subProgram.id}`
                                  ) || 'assistant_coach'
                                }
                                onValueChange={(value) =>
                                  setAssignmentRole(
                                    `subprogram_${subProgram.id}`,
                                    value as CoachRole
                                  )
                                }
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COACH_ROLES.map((role) => (
                                    <SelectItem
                                      key={role.value}
                                      value={role.value}
                                    >
                                      {role.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          {/* Groups */}
                          {subProgram.groups &&
                            subProgram.groups.length > 0 &&
                            subProgram.groups.map((group: Group) => (
                              <div
                                key={group.id}
                                className="ml-8 flex items-center gap-3"
                              >
                                <Checkbox
                                  id={`group_${group.id}`}
                                  checked={selectedAssignments.has(
                                    `group_${group.id}`
                                  )}
                                  onCheckedChange={() =>
                                    toggleAssignment(`group_${group.id}`)
                                  }
                                />
                                <Label
                                  htmlFor={`group_${group.id}`}
                                  className="cursor-pointer text-sm"
                                >
                                  {group.name} (Group)
                                </Label>
                                {selectedAssignments.has(
                                  `group_${group.id}`
                                ) && (
                                  <Select
                                    value={
                                      assignmentRoles.get(`group_${group.id}`) ||
                                      'assistant_coach'
                                    }
                                    onValueChange={(value) =>
                                      setAssignmentRole(
                                        `group_${group.id}`,
                                        value as CoachRole
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {COACH_ROLES.map((role) => (
                                        <SelectItem
                                          key={role.value}
                                          value={role.value}
                                        >
                                          {role.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => router.push(`${basePath}/coaches`)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Assignments'}
        </Button>
      </div>
    </div>
  )
}

