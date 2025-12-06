'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useParentClub } from '@/lib/use-parent-club'
import { useAdminSeason } from '@/lib/use-admin-season'
import { useCart } from '@/lib/cart-context'
import { clubQuery } from '@/lib/supabase-helpers'
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
  registration_fee?: number | null
  max_capacity?: number | null
  is_active: boolean
  program_id: string
}

type ProgramWithSubPrograms = Program & {
  sub_programs: SubProgram[]
}

export default function ParentProgramsPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { clubId, household, athletes, loading: authLoading, error: authError } =
    useParentClub()
  const { selectedSeason, loading: seasonLoading } = useAdminSeason()
  const { addItem } = useCart()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<ProgramWithSubPrograms[]>([])
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('')

  useEffect(() => {
    async function load() {
      if (authLoading || seasonLoading || !clubId || !selectedSeason) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Load active programs with sub-programs for the current season
        const { data, error: programsError } = await clubQuery(
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
                registration_fee,
                max_capacity,
                is_active,
                program_id
              )
            `)
            .eq('season_id', selectedSeason.id)
            .eq('status', ProgramStatus.ACTIVE)
            .order('name', { ascending: true }),
          clubId
        )

        if (programsError) {
          setError(programsError.message)
        } else {
          const allPrograms = (data || []) as any[]
          const activePrograms = allPrograms
            .map(program => ({
              ...program,
              sub_programs: (program.sub_programs || []).filter(
                (sp: SubProgram) => sp.is_active === true
              ),
            }))
            .filter((p: ProgramWithSubPrograms) => p.sub_programs.length > 0) as ProgramWithSubPrograms[]
          setPrograms(activePrograms)
        }
      } catch (err) {
        console.error('Error loading programs:', err)
        setError('Failed to load programs')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [clubId, authLoading, authError, selectedSeason, seasonLoading])

  function handleAddToCart(subProgram: SubProgram, program: Program) {
    if (!selectedAthleteId) {
      alert('Please select an athlete first')
      return
    }

    const athlete = athletes.find(a => a.id === selectedAthleteId)
    if (!athlete) {
      alert('Selected athlete not found')
      return
    }

    const price = subProgram.registration_fee || 0

    addItem({
      id: `${subProgram.id}-${athlete.id}-${Date.now()}`, // Temporary ID
      athlete_id: athlete.id,
      athlete_name: `${athlete.first_name} ${athlete.last_name}`,
      sub_program_id: subProgram.id,
      sub_program_name: subProgram.name,
      program_name: program.name,
      price,
    })

    alert(`Added ${program.name} - ${subProgram.name} for ${athlete.first_name} to cart`)
  }

  if (authLoading || seasonLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading programs…</p>
      </div>
    )
  }

  if (error || authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error || authError}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
        <p className="text-muted-foreground">
          Browse and register for programs for {selectedSeason?.name || 'the current season'}
        </p>
      </div>

      {athletes.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              You need to add athletes before you can register for programs.{' '}
              <a href={`/clubs/${clubSlug}/parent/athletes`} className="text-blue-600 hover:underline">
                Add an athlete
              </a>
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Select Athlete</CardTitle>
              <CardDescription>
                Choose which athlete you're registering for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <select
                value={selectedAthleteId}
                onChange={e => setSelectedAthleteId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">-- Select an athlete --</option>
                {athletes.map(athlete => (
                  <option key={athlete.id} value={athlete.id}>
                    {athlete.first_name} {athlete.last_name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {programs.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  No active programs available for this season.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {programs.map(program => (
                <Card key={program.id}>
                  <CardHeader>
                    <CardTitle>{program.name}</CardTitle>
                    {program.description && (
                      <CardDescription>{program.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {program.sub_programs.map(subProgram => (
                        <div
                          key={subProgram.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex-1">
                            <h3 className="font-semibold">{subProgram.name}</h3>
                            {subProgram.description && (
                              <p className="text-sm text-muted-foreground">
                                {subProgram.description}
                              </p>
                            )}
                            <p className="mt-2 text-sm font-medium">
                              ${(subProgram.registration_fee || 0).toFixed(2)}
                            </p>
                            {subProgram.max_capacity && (
                              <p className="text-xs text-muted-foreground">
                                Capacity: {subProgram.max_capacity}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleAddToCart(subProgram, program)}
                            disabled={!selectedAthleteId}
                            size="sm"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
