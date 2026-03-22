'use client'

import { useEffect, useState } from 'react'
import { useClub } from '@/lib/club-context'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Users } from 'lucide-react'

type WaitlistEntry = {
  registration_id: string
  athlete_name: string
  household_name: string
  program_name: string
  sub_program_name: string
  sub_program_id: string
  queue_position: number
  registered_at: string
}

type WaitlistGroup = {
  program_name: string
  sub_program_name: string
  sub_program_id: string
  entries: WaitlistEntry[]
}

export default function AdminWaitlistPage() {
  const { club } = useClub()
  const currentSeason = useCurrentSeason()
  const [groups, setGroups] = useState<WaitlistGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!club?.id || !currentSeason?.id) return

    const supabase = createClient()

    async function load() {
      setLoading(true)
      try {
        const [{ data: regData }, { data: posData }] = await Promise.all([
          supabase
            .from('registrations')
            .select(`
              id,
              athlete_id,
              created_at,
              sub_programs!inner(
                id,
                name,
                programs!inner(name, club_id)
              ),
              athletes!inner(first_name, last_name, household_id)
            `)
            .eq('status', 'waitlisted')
            .eq('season_id', currentSeason!.id)
            .eq('sub_programs.programs.club_id', club!.id),
          supabase.rpc('get_waitlist_positions', { p_season_id: currentSeason!.id }),
        ])

        const posMap = new Map<string, number>()
        for (const row of posData ?? []) {
          posMap.set(row.registration_id, row.queue_position)
        }

        // Fetch household guardian names
        const householdIds = [
          ...new Set(
            (regData ?? []).map(
              (r: any) => r.athletes?.household_id as string
            ).filter(Boolean)
          ),
        ]

        const { data: guardianRows } = await supabase
          .from('household_guardians')
          .select('household_id, profiles!inner(last_name)')
          .in('household_id', householdIds)
          .eq('is_primary', true)

        const householdNameMap = new Map<string, string>()
        for (const row of guardianRows ?? []) {
          const profiles = row.profiles as any
          householdNameMap.set(row.household_id, `${profiles?.last_name ?? ''} Family`.trim())
        }

        // Build grouped structure
        const groupMap = new Map<string, WaitlistGroup>()
        for (const r of (regData ?? []) as any[]) {
          const subProgram = r.sub_programs
          const prog = subProgram?.programs
          if (!prog) continue

          const key = subProgram.id
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              program_name: prog.name,
              sub_program_name: subProgram.name,
              sub_program_id: subProgram.id,
              entries: [],
            })
          }

          groupMap.get(key)!.entries.push({
            registration_id: r.id,
            athlete_name: `${r.athletes?.first_name ?? ''} ${r.athletes?.last_name ?? ''}`.trim(),
            household_name: householdNameMap.get(r.athletes?.household_id) ?? 'Unknown',
            program_name: prog.name,
            sub_program_name: subProgram.name,
            sub_program_id: subProgram.id,
            queue_position: posMap.get(r.id) ?? 0,
            registered_at: r.created_at,
          })
        }

        // Sort each group by queue position
        for (const group of groupMap.values()) {
          group.entries.sort((a, b) => a.queue_position - b.queue_position)
        }

        // Sort groups by program name then sub-program name
        const sorted = Array.from(groupMap.values()).sort((a, b) =>
          a.program_name.localeCompare(b.program_name) ||
          a.sub_program_name.localeCompare(b.sub_program_name)
        )

        setGroups(sorted)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [club?.id, currentSeason?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalWaitlisted = groups.reduce((sum, g) => sum + g.entries.length, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Waitlist</h1>
        <p className="text-muted-foreground">
          Athletes waiting for a spot — ordered by sign-up time (FIFO). Spots are filled
          automatically when capacity opens.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading waitlist…</p>
      ) : totalWaitlisted === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No athletes are currently on the waitlist.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <Card key={group.sub_program_id} className="border-purple-800/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{group.sub_program_name}</CardTitle>
                    <CardDescription>{group.program_name}</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-purple-700 text-purple-400 gap-1">
                    <Users className="h-3 w-3" />
                    {group.entries.length} waiting
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-900 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2 font-medium w-10">#</th>
                        <th className="text-left px-4 py-2 font-medium">Athlete</th>
                        <th className="text-left px-4 py-2 font-medium">Family</th>
                        <th className="text-left px-4 py-2 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.entries.map((entry) => (
                        <tr key={entry.registration_id} className="hover:bg-zinc-900/50">
                          <td className="px-4 py-2.5">
                            <span className="text-purple-400 font-semibold">
                              {entry.queue_position}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium">{entry.athlete_name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{entry.household_name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {new Date(entry.registered_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
