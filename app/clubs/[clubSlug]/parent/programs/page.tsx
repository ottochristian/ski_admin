'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useParentClub } from '@/lib/use-parent-club'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { usePrograms } from '@/lib/hooks/use-programs'
import { useCart } from '@/lib/cart-context'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, ShoppingCart } from 'lucide-react'
import { ProgramStatus } from '@/lib/programStatus'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

type Program = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus | null
  sub_programs?: SubProgram[]
}

type SubProgram = {
  id: string
  name: string
  description?: string | null
  registration_fee?: number | null
  max_capacity?: number | null
  status: ProgramStatus
  program_id: string
  registrations?: { count: number }[]
}

type ProgramWithSubPrograms = Program & {
  sub_programs: SubProgram[]
}

export default function ParentProgramsPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const {
    clubId,
    household,
    athletes,
    loading: authLoading,
    error: authError,
  } = useParentClub()
  const { addItem } = useCart()

  // PHASE 2: Use base useSeason hook - RLS handles filtering
  const currentSeason = useCurrentSeason()

  // PHASE 2: RLS handles club filtering automatically
  const {
    data: allPrograms = [],
    isLoading: programsLoading,
    error: programsError,
  } = usePrograms(currentSeason?.id, true) // Include sub-programs

  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('')

  // Filter to active programs only
  const programs = allPrograms.filter(
    (p: any) => p.status === ProgramStatus.ACTIVE || p.status === null
  ) as ProgramWithSubPrograms[]

  // Set default athlete if available
  // Use stable athlete IDs instead of athletes array to avoid infinite loops
  const athleteIds = athletes?.map((a) => a.id).join(',') || ''
  useEffect(() => {
    if (athletes && athletes.length > 0 && !selectedAthleteId) {
      setSelectedAthleteId(athletes[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteIds, selectedAthleteId])

  const handleAddToCart = (
    subProgram: SubProgram,
    program: Program,
    athleteId: string
  ) => {
    if (!athleteId) {
      alert('Please select an athlete first')
      return
    }

    const athlete = athletes?.find((a) => a.id === athleteId)
    if (!athlete) {
      alert('Athlete not found')
      return
    }

    addItem({
      id: `${subProgram.id}-${athleteId}`, // Temporary ID for cart
      athlete_id: athleteId,
      athlete_name: `${athlete.first_name} ${athlete.last_name}`,
      sub_program_id: subProgram.id,
      sub_program_name: subProgram.name,
      program_name: program.name,
      price: subProgram.registration_fee ?? 0,
    })
  }

  const isLoading = authLoading || programsLoading

  // Show message if no current season (only after auth is loaded)
  if (!authLoading && !currentSeason) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg text-center">
          <CardHeader className="space-y-3 pb-6">
            <CardTitle className="text-2xl">No Season Available</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              No current season found.
              <br />
              Please contact support for assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Check if current season is accepting registrations
  const isSeasonOpen = currentSeason.status === 'active'
  const isSeasonClosed = currentSeason.status === 'closed'
  const isSeasonDraft = currentSeason.status === 'draft'

  if (!household || !athletes || athletes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>
              Please set up your household and add athletes before viewing
              programs.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Don't show programs if season is in draft mode
  if (isSeasonDraft) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg text-center">
          <CardHeader className="space-y-3 pb-6">
            <CardTitle className="text-2xl">Season Not Available</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              The current season is being set up.
              <br />
              Programs will be available soon.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Available Programs</h1>
        <p className="text-muted-foreground">
          Browse and register for programs for {currentSeason.name}
        </p>
      </div>

      {/* Athlete Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Athlete</CardTitle>
          <CardDescription>
            Choose which athlete you're registering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedAthleteId}
            onChange={(e) => setSelectedAthleteId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select an athlete</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.first_name} {athlete.last_name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Programs List */}
      {programsLoading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 w-48 rounded bg-gray-200" />
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="h-32 rounded bg-gray-200" />
                    <div className="h-32 rounded bg-gray-200" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : programsError ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-red-600 mb-4">
                {programsError.message || 'Failed to load programs'}
              </p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No active programs available for this season.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardHeader>
                <CardTitle>{program.name}</CardTitle>
                {program.description && (
                  <CardDescription>{program.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {program.sub_programs &&
                program.sub_programs.length > 0 ? (
                  <div className="space-y-4">
                    {program.sub_programs
                      .filter((sp) => sp.status === ProgramStatus.ACTIVE)
                      .map((subProgram) => (
                        <div
                          key={subProgram.id}
                          className="flex items-center justify-between border rounded-lg p-4"
                        >
                          <div className="flex-1">
                            <h3 className="font-semibold">{subProgram.name}</h3>
                            {subProgram.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {subProgram.description}
                              </p>
                            )}
                            <div className="mt-2 flex gap-4 text-sm">
                              {subProgram.registration_fee !== null && subProgram.registration_fee !== undefined && (
                                <span className="font-medium text-lg">
                                  ${(subProgram.registration_fee).toFixed(2)}
                                </span>
                              )}
                              {subProgram.max_capacity !== null && subProgram.max_capacity !== undefined && (() => {
                                const registrationCount = subProgram.registrations?.[0]?.count || 0
                                const spotsLeft = subProgram.max_capacity - registrationCount
                                return (
                                  <span className={`text-sm ${spotsLeft <= 5 && spotsLeft > 0 ? 'text-orange-600 font-medium' : spotsLeft === 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                    {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
                                  </span>
                                )
                              })()}
                            </div>
                          </div>
                          <Button
                            onClick={() =>
                              handleAddToCart(subProgram, program, selectedAthleteId)
                            }
                            disabled={!selectedAthleteId || isSeasonClosed}
                            size="sm"
                            title={isSeasonClosed ? 'Registration closed for this season' : ''}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {isSeasonClosed ? 'Registration Closed' : 'Add to Cart'}
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No sub-programs available for this program.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
