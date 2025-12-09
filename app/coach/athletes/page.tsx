'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useClub } from '@/lib/club-context'
import { useCoachSeason } from '@/lib/use-coach-season'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin-page-header'

interface Profile {
  id: string
  email: string
  first_name?: string | null
  role: string
}

interface Coach {
  id: string
  profile_id: string
}

interface CoachAssignment {
  id: string
  role?: string | null
  program_id?: string | null
  sub_program_id?: string | null
  group_id?: string | null
  programs?: { name?: string | null } | { name?: string | null }[] | null
  sub_programs?: { name?: string | null } | { name?: string | null }[] | null
  groups?: { name?: string | null } | { name?: string | null }[] | null
}

interface Athlete {
  id: string
  first_name?: string | null
  last_name?: string | null
  date_of_birth?: string | null
  gender?: string | null
  program_name?: string | null
  sub_program_name?: string | null
  group_name?: string | null
}

export default function CoachAthletesPage() {
  const router = useRouter()
  const { club, loading: clubLoading } = useClub()
  const { selectedSeason, loading: seasonLoading } = useCoachSeason()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [coach, setCoach] = useState<Coach | null>(null)
  const [assignments, setAssignments] = useState<CoachAssignment[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // 1) Ensure user is logged in
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      // 2) Fetch profile and ensure coach role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      if (!profileData || profileData.role !== 'coach') {
        router.push('/login')
        return
      }

      setProfile(profileData as Profile)

      // 3) Fetch coach row
      // Try query first to see if any records exist
      let coachData: any = null
      let coachError: any = null
      
      try {
        const result = await supabase
          .from('coaches')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle() // Use maybeSingle instead of single to avoid error if no rows
        
        coachData = result.data
        coachError = result.error
      } catch (err) {
        // Catch any unexpected errors
        console.error('[coach/athletes] Unexpected error fetching coach:', err)
        coachError = err instanceof Error ? err : { message: String(err) }
      }

      if (coachError) {
        // Enhanced error logging
        const errorInfo = {
          message: coachError?.message || 'No message',
          details: coachError?.details || 'No details',
          hint: coachError?.hint || 'No hint',
          code: coachError?.code || 'No code',
          status: coachError?.status || 'No status',
          statusText: coachError?.statusText || 'No statusText',
          profileId: user.id,
          profileRole: profileData.role,
          profileClubId: profileData.club_id,
          errorString: JSON.stringify(coachError),
        }
        
        console.error('[coach/athletes] Error loading coach record:', errorInfo)
        
        // Check if it's a "no rows" error (coach record doesn't exist)
        const isNoRowsError = 
          coachError?.code === 'PGRST116' || 
          coachError?.message?.includes('No rows') ||
          coachError?.message?.includes('0 rows') ||
          coachError?.code === '42P01' // undefined_table
        
        if (isNoRowsError) {
          setError(
            `Your coach account is not fully set up. Please contact an administrator to complete your coach profile setup.`
          )
          setLoading(false)
          return
        }
        
        // RLS policy error
        if (
          coachError?.message?.includes('policy') || 
          coachError?.message?.includes('permission') ||
          coachError?.message?.includes('RLS') ||
          coachError?.code === '42501'
        ) {
          setError(
            `Permission denied accessing coach profile. Please contact an administrator.`
          )
          setLoading(false)
          return
        }
        
        // For other errors, show detailed message
        setError(
          `Unable to load coach profile: ${coachError?.message || 'Unknown error'}. Please contact an administrator.`
        )
        setLoading(false)
        return
      }

      if (!coachData) {
        setError(
          `Your coach account is not fully set up. Please contact an administrator to complete your coach profile setup.`
        )
        setLoading(false)
        return
      }

      setCoach(coachData as Coach)
    }

    if (!clubLoading) {
      load()
    }
  }, [router, club, clubLoading])

  // Wait for season to load before loading athletes
  useEffect(() => {
    if (coach?.id && selectedSeason && club?.id && !seasonLoading) {
      // Trigger athletes reload by updating loading state
      setLoading(false)
    }
  }, [coach?.id, selectedSeason, club?.id, seasonLoading])

  // Load assignments and athletes when season is selected
  useEffect(() => {
    async function loadAthletes() {
      if (!coach?.id || !selectedSeason || !club?.id) {
        return
      }

      try {
        // 1) Load coach's assignments for the selected season
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('coach_assignments')
          .select(
            `
            id,
            role,
            program_id,
            sub_program_id,
            group_id,
            programs (name),
            sub_programs (name),
            groups (name)
          `
          )
          .eq('coach_id', coach.id)
          .eq('season_id', selectedSeason.id)
          .eq('club_id', club.id)

        if (assignmentsError) {
          console.error('Error loading assignments:', assignmentsError)
          setAssignments([])
          setAthletes([])
          return
        }

        setAssignments(assignmentsData || [])

        // 2) If no assignments, no athletes to show
        if (!assignmentsData || assignmentsData.length === 0) {
          setAthletes([])
          return
        }

        // 3) Collect all relevant sub_program_ids and group_ids from assignments
        const subProgramIds = new Set<string>()
        const groupIds = new Set<string>()
        const programIds = new Set<string>()

        assignmentsData.forEach((assignment) => {
          if (assignment.group_id) {
            groupIds.add(assignment.group_id)
          }
          if (assignment.sub_program_id) {
            subProgramIds.add(assignment.sub_program_id)
          }
          if (assignment.program_id) {
            programIds.add(assignment.program_id)
          }
        })

        // If assigned to programs, get all their sub-programs
        if (programIds.size > 0) {
          const { data: subProgramsData } = await supabase
            .from('sub_programs')
            .select('id')
            .in('program_id', Array.from(programIds))
            .eq('club_id', club.id)

          subProgramsData?.forEach((sp: any) => {
            subProgramIds.add(sp.id)
          })
        }

        // If assigned to groups, get their sub-program_ids
        if (groupIds.size > 0) {
          const { data: groupsData } = await supabase
            .from('groups')
            .select('sub_program_id')
            .in('id', Array.from(groupIds))
            .eq('club_id', club.id)

          groupsData?.forEach((g: any) => {
            if (g.sub_program_id) {
              subProgramIds.add(g.sub_program_id)
            }
          })
        }

        // 4) Get athletes from registrations matching these sub-programs
        if (subProgramIds.size === 0) {
          setAthletes([])
          return
        }

        // Fetch registrations with athlete and program details
        const { data: registrationsData, error: registrationsError } = await supabase
          .from('registrations')
          .select(
            `
            id,
            athlete_id,
            sub_program_id,
            athletes!inner(
              id,
              first_name,
              last_name,
              date_of_birth,
              gender
            ),
            sub_programs!inner(
              id,
              name,
              programs!inner(
                id,
                name
              ),
              groups(
                id,
                name
              )
            )
          `
          )
          .in('sub_program_id', Array.from(subProgramIds))
          .eq('season_id', selectedSeason.id)
          .eq('club_id', club.id)
          .eq('status', 'confirmed')

        if (registrationsError) {
          console.error('Error loading registrations:', registrationsError)
          setAthletes([])
          return
        }

        // 5) Transform and deduplicate athletes
        const athleteMap = new Map<string, Athlete>()

        registrationsData?.forEach((reg: any) => {
          const athlete = reg.athletes
          if (!athlete) return

          const athleteId = athlete.id
          const subProgram = reg.sub_programs

          // Get group name if athlete's registration matches a group assignment
          let groupName: string | null = null
          if (groupIds.size > 0 && subProgram?.groups) {
            // Find if any of the groups match the coach's group assignments
            for (const group of subProgram.groups || []) {
              if (groupIds.has(group.id)) {
                groupName = group.name
                break
              }
            }
          }

          // Use existing athlete data or create new entry
          const existing = athleteMap.get(athleteId)
          if (existing) {
            // If athlete already exists, prefer group assignment if available
            if (!existing.group_name && groupName) {
              existing.group_name = groupName
            }
            // Prefer more specific program info if available
            if (!existing.program_name && subProgram?.programs?.name) {
              existing.program_name = subProgram.programs.name
            }
            if (!existing.sub_program_name && subProgram?.name) {
              existing.sub_program_name = subProgram.name
            }
          } else {
            athleteMap.set(athleteId, {
              id: athlete.id,
              first_name: athlete.first_name,
              last_name: athlete.last_name,
              date_of_birth: athlete.date_of_birth,
              gender: athlete.gender,
              program_name: subProgram?.programs?.name || null,
              sub_program_name: subProgram?.name || null,
              group_name: groupName,
            })
          }
        })

        // Convert to array and sort
        const sortedAthletes = Array.from(athleteMap.values()).sort((a, b) => {
          const aName = `${a.first_name || ''} ${a.last_name || ''}`.trim()
          const bName = `${b.first_name || ''} ${b.last_name || ''}`.trim()
          return aName.localeCompare(bName)
        })

        setAthletes(sortedAthletes)
      } catch (err) {
        console.error('Error loading athletes:', err)
        setError('Failed to load athletes')
        setAthletes([])
      } finally {
        setLoading(false)
      }
    }

    if (coach?.id && selectedSeason && club?.id) {
      loadAthletes()
    }
  }, [coach?.id, selectedSeason?.id, club?.id])

  if (loading || clubLoading || seasonLoading || !selectedSeason) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">Loading athletes…</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/coach">
            <Button>Back to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (!profile || !coach) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/coach">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <AdminPageHeader title="Athletes" />
      </div>

      <div>
        {/* Assignments Info */}
        {assignments.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Your Assignments</CardTitle>
              <CardDescription>
                Athletes shown below are from your assigned programs, sub-programs, and groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {assignments.map((assignment) => {
                  // Handle both single object and array formats from Supabase
                  const groupsName = Array.isArray(assignment.groups)
                    ? assignment.groups[0]?.name
                    : assignment.groups?.name
                  const subProgramsName = Array.isArray(assignment.sub_programs)
                    ? assignment.sub_programs[0]?.name
                    : assignment.sub_programs?.name
                  const programsName = Array.isArray(assignment.programs)
                    ? assignment.programs[0]?.name
                    : assignment.programs?.name

                  const name = groupsName || subProgramsName || programsName || 'Unknown'
                  const roleLabel =
                    assignment.role === 'head_coach'
                      ? 'Head Coach'
                      : assignment.role === 'assistant_coach'
                      ? 'Assistant Coach'
                      : assignment.role === 'substitute_coach'
                      ? 'Substitute Coach'
                      : 'Coach'
                  const displayName = `${roleLabel} ${name}`

                  return (
                    <span
                      key={assignment.id}
                      className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                    >
                      {displayName}
                    </span>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Athletes List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Athletes ({athletes.length})
              {selectedSeason && ` - ${selectedSeason.name}`}
            </CardTitle>
            <CardDescription>
              {assignments.length === 0
                ? 'No assignments found. Please contact an administrator.'
                : athletes.length === 0
                ? 'No athletes registered for your assigned programs this season.'
                : 'Athletes registered in your assigned programs, sub-programs, or groups'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {athletes.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date of Birth</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Sub-Program</TableHead>
                      <TableHead>Group</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {athletes.map((athlete) => (
                      <TableRow key={athlete.id}>
                        <TableCell className="font-medium">
                          {athlete.first_name} {athlete.last_name}
                        </TableCell>
                        <TableCell>
                          {athlete.date_of_birth
                            ? new Date(athlete.date_of_birth).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell className="capitalize">
                          {athlete.gender || '-'}
                        </TableCell>
                        <TableCell>{athlete.program_name || '-'}</TableCell>
                        <TableCell>{athlete.sub_program_name || '-'}</TableCell>
                        <TableCell>{athlete.group_name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  {!selectedSeason
                    ? 'Please select a season to view athletes.'
                    : assignments.length === 0
                    ? 'You have no assignments for this season.'
                    : 'No athletes found for your assignments in this season.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
