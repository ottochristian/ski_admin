'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useParentClub } from '@/lib/use-parent-club'
import { useClub } from '@/lib/club-context'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { useHouseholdGuardians } from '@/lib/hooks/use-household-guardians'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, ShoppingCart, User, CreditCard, Calendar, MapPin, Clock, ChevronRight, X, AlertCircle } from 'lucide-react'
import { useUpcomingEvents } from '@/lib/hooks/use-events'
import { toast } from 'sonner'

type WaitlistEntry = {
  registration_id: string
  athlete_name: string
  program_name: string
  sub_program_name: string
  queue_position: number
}

type PendingPaymentEntry = {
  registration_id: string
  athlete_name: string
  program_name: string
  sub_program_name: string
}

export default function ParentDashboardPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { household, athletes, profile } = useParentClub()
  const { club } = useClub()
  const currentSeason = useCurrentSeason()
  const { data: guardians = [], isLoading: guardiansLoading } = useHouseholdGuardians(household?.id)
  const { data: upcomingEvents = [] } = useUpcomingEvents(club?.id, 5)

  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentEntry[]>([])

  const seasonId = currentSeason?.id
  const athleteIdList = athletes?.map((a) => a.id).join(',') ?? ''

  useEffect(() => {
    if (!seasonId || !athleteIdList) return
    const supabase = createClient()
    const athleteIds = athleteIdList.split(',')

    const run = async () => {
      const [{ data: regData }, { data: posData }] = await Promise.all([
        supabase
          .from('registrations')
          .select(`
            id,
            athlete_id,
            sub_programs!inner(
              name,
              programs!inner(name)
            )
          `)
          .eq('season_id', seasonId)
          .eq('status', 'waitlisted')
          .in('athlete_id', athleteIds),
        supabase.rpc('get_waitlist_positions', { p_season_id: seasonId }),
      ])

      const posMap = new Map<string, number>()
      for (const row of posData ?? []) {
        posMap.set(row.registration_id, row.queue_position)
      }

      const athleteMap = new Map(
        (athletes ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`])
      )

      const entries: WaitlistEntry[] = ((regData ?? []) as unknown as { id: string; athlete_id: string; sub_programs: { name: string; programs: { name: string } } }[]).map((r) => ({
        registration_id: r.id,
        athlete_name: athleteMap.get(r.athlete_id) ?? 'Unknown',
        program_name: r.sub_programs?.programs?.name ?? '',
        sub_program_name: r.sub_programs?.name ?? '',
        queue_position: posMap.get(r.id) ?? 0,
      }))

      entries.sort((a, b) => a.athlete_name.localeCompare(b.athlete_name))
      setWaitlist(entries)
    }
    run()
  }, [seasonId, athleteIdList]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load pending registrations that were promoted from waitlist and haven't been paid yet
  useEffect(() => {
    if (!seasonId || !athleteIdList) return
    const supabase = createClient()
    const athleteIds = athleteIdList.split(',')

    const run = async () => {
      // Get all pending registrations for this household
      const { data: pendingRegs } = await supabase
        .from('registrations')
        .select(`
          id,
          athlete_id,
          sub_programs!inner(name, programs!inner(name))
        `)
        .eq('season_id', seasonId)
        .eq('status', 'pending')
        .in('athlete_id', athleteIds)

      if (!pendingRegs || pendingRegs.length === 0) {
        setPendingPayments([])
        return
      }

      // Filter to only those without an existing order (promoted from waitlist, not mid-checkout)
      const regIds = pendingRegs.map((r: any) => r.id)
      const { data: existingItems } = await supabase
        .from('order_items')
        .select('registration_id')
        .in('registration_id', regIds)

      const alreadyOrdered = new Set((existingItems ?? []).map((i: any) => i.registration_id))

      const athleteMap = new Map(
        (athletes ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`])
      )

      const entries: PendingPaymentEntry[] = (pendingRegs as any[])
        .filter((r) => !alreadyOrdered.has(r.id))
        .map((r) => ({
          registration_id: r.id,
          athlete_name: athleteMap.get(r.athlete_id) ?? 'Unknown',
          program_name: r.sub_programs?.programs?.name ?? '',
          sub_program_name: r.sub_programs?.name ?? '',
        }))

      setPendingPayments(entries)
    }
    run()
  }, [seasonId, athleteIdList]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRemoveFromWaitlist(registrationId: string, name: string) {
    setRemovingId(registrationId)
    const supabase = createClient()
    const { error } = await supabase
      .from('registrations')
      .update({ status: 'cancelled' })
      .eq('id', registrationId)

    if (error) {
      toast.error('Failed to remove from waitlist')
    } else {
      toast.success(`${name} removed from waitlist`)
      setWaitlist((prev) => prev.filter((e) => e.registration_id !== registrationId))
    }
    setRemovingId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {club?.logo_url && (
          <div className="h-16 w-16 flex-shrink-0">
            <img
              src={club.logo_url}
              alt={club.name || 'Club logo'}
              className="h-full w-full object-contain rounded-lg"
              onError={(e) => {
                // Hide image if it fails to load
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="page-title truncate">
            {club?.name ? `${club.name} Dashboard` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground truncate">
            Welcome to your parent portal
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Household</CardTitle>
            <CardDescription>Your family information</CardDescription>
          </CardHeader>
          <CardContent>
            {household && (
              <div className="space-y-4">
                {/* Guardians */}
                {guardiansLoading ? (
                  <p className="text-sm text-muted-foreground">Loading guardians...</p>
                ) : guardians.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Guardians
                    </p>
                    {guardians.map((guardian) => {
                      const guardianProfile = guardian.profiles
                      const isCurrentUser = guardian.user_id === profile?.id
                      const displayName = guardianProfile?.first_name || guardianProfile?.last_name
                        ? `${guardianProfile.first_name || ''} ${guardianProfile.last_name || ''}`.trim()
                        : guardianProfile?.email || 'Unknown'
                      
                      return (
                        <div key={guardian.id} className="flex items-center justify-between gap-2">
                          <p className="text-sm truncate min-w-0">
                            {displayName}
                            {isCurrentUser && (
                              <span className="ml-1 text-xs text-muted-foreground">(You)</span>
                            )}
                          </p>
                          {guardian.is_primary ? (
                            <Badge variant="default" className="text-xs shrink-0">Primary</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs shrink-0">Secondary</Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
                
                {/* Contact Information */}
                <div className="space-y-2 border-t pt-4">
                  {household.primary_email && (
                    <p className="text-sm break-all">
                      <span className="font-medium">Email:</span>{' '}
                      {household.primary_email}
                    </p>
                  )}
                  {household.phone && (
                    <p className="text-sm">
                      <span className="font-medium">Phone:</span> {household.phone}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Athletes</CardTitle>
            <CardDescription>Manage your athletes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="metric-value">{athletes.length}</p>
              <Link href={`/clubs/${clubSlug}/parent/athletes`}>
                <Button variant="outline" size="sm" className="w-full">
                  <User className="h-4 w-4 mr-2" />
                  View Athletes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/clubs/${clubSlug}/parent/programs`}>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Browse Programs
              </Button>
            </Link>
            <Link href={`/clubs/${clubSlug}/parent/athletes/new`}>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Add Athlete
              </Button>
            </Link>
            <Link href={`/clubs/${clubSlug}/parent/billing`}>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <CreditCard className="h-4 w-4 mr-2" />
                View Billing
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Action Required: promoted from waitlist, payment needed */}
      {pendingPayments.length > 0 && (
        <Card className="border-yellow-700/40 bg-yellow-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <CardTitle className="text-base text-yellow-300">Action Required</CardTitle>
            </div>
            <CardDescription>
              A spot opened up — please complete payment to secure your registration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPayments.map((entry) => (
              <div
                key={entry.registration_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-yellow-800/30 bg-yellow-950/20 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.athlete_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {entry.program_name} — {entry.sub_program_name}
                  </p>
                </div>
                <Badge variant="outline" className="border-yellow-700 text-yellow-400 text-xs shrink-0">
                  Awaiting Payment
                </Badge>
              </div>
            ))}
            <Link href={`/clubs/${clubSlug}/parent/pending-payment`}>
              <Button className="w-full mt-2 bg-yellow-600 hover:bg-yellow-500 text-black font-semibold">
                Complete Registration
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Waitlist */}
      {waitlist.length > 0 && (
        <Card className="border-purple-800/40 bg-purple-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-400" />
              <CardTitle className="text-base text-purple-300">On the Waitlist</CardTitle>
            </div>
            <CardDescription>
              You&apos;ll be notified if a spot opens up. No payment is collected until you&apos;re promoted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {waitlist.map((entry) => (
              <div
                key={entry.registration_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-purple-800/30 bg-purple-950/20 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.athlete_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {entry.program_name} — {entry.sub_program_name}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="border-purple-700 text-purple-400 text-xs">
                    #{entry.queue_position} in queue
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromWaitlist(entry.registration_id, entry.athlete_name)}
                    disabled={removingId === entry.registration_id}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    title="Remove from waitlist"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Events */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <h2 className="font-semibold text-foreground">Upcoming Events</h2>
          </div>
          <Link href={`/clubs/${clubSlug}/parent/schedule`} className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 font-medium">
            Full schedule <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {upcomingEvents.map((ev) => {
              const start = new Date(ev.start_at)
              const typeColors: Record<string, string> = {
                training: 'bg-orange-500', race: 'bg-red-500', camp: 'bg-purple-500',
                meeting: 'bg-yellow-500', other: 'bg-zinc-400',
              }
              return (
                <div key={ev.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-zinc-800/60">
                  {/* Date block */}
                  <div className="flex-shrink-0 w-10 text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {start.toLocaleDateString('en-US', { month: 'short' })}
                    </p>
                    <p className="text-xl font-bold text-foreground leading-none">{start.getDate()}</p>
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${typeColors[ev.event_type] ?? 'bg-zinc-400'}`} />
                      <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {ev.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {ev.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
