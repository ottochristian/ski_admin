'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParentClub } from '@/lib/use-parent-club'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { useAthlete, useUpdateAthlete } from '@/lib/hooks/use-athletes'
import { useAthleteRegistrations } from '@/lib/hooks/use-registrations'
import { useWaivers, useAthleteWaiverStatus } from '@/lib/hooks/use-waivers'
import { WaiverSignDialog } from '@/components/waiver-sign-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'
import {
  ArrowLeft, BookOpen, Edit2, Save, X,
  CheckCircle2, AlertCircle, Phone, User, PenLine,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAthleteCategory, FIS_DEFAULT_CATEGORIES, type AgeCalculationMethod } from '@/lib/ski-categories'
import { useClub } from '@/lib/club-context'


type Reg = {
  id: string
  status: string
  payment_status: string | null
  amount_paid: number | null
  created_at: string
  season_id: string
  sub_programs?: { name: string; programs?: { name: string } | null } | null
  seasons?: { id: string; name: string } | null
}

function RegRow({ reg }: { reg: Reg }) {
  const program = reg.sub_programs?.programs?.name ?? 'Unknown Program'
  const subProgram = reg.sub_programs?.name ?? ''
  const season = reg.seasons?.name ?? ''
  const isPaid = reg.payment_status === 'paid'

  const statusColor: Record<string, string> = {
    confirmed: 'bg-green-950/30 text-green-400',
    active: 'bg-green-950/30 text-green-400',
    pending: 'bg-yellow-950/30 text-yellow-400',
    waitlisted: 'bg-blue-950/30 text-blue-400',
    cancelled: 'bg-secondary text-muted-foreground line-through',
  }

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-sm font-medium truncate">{program}</p>
      <p className="text-xs text-muted-foreground truncate">
        {subProgram}{season ? ` · ${season}` : ''}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor[reg.status] ?? 'bg-secondary text-foreground'}`}>
          {reg.status}
        </span>
        {reg.status !== 'cancelled' && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${isPaid ? 'bg-green-950/30 text-green-400' : 'bg-orange-950/30 text-orange-400'}`}>
            {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {isPaid ? 'Paid' : 'Unpaid'}
          </span>
        )}
      </div>
    </div>
  )
}

export default function AthleteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const athleteId = params.athleteId as string

  const { profile, household, loading: authLoading } = useParentClub()
  const { club } = useClub()
  const ageMethod = ((club as any)?.age_calculation_method ?? 'fis_competition_year') as AgeCalculationMethod
  const ageCategories = (club as any)?.age_categories ?? FIS_DEFAULT_CATEGORIES
  const currentSeason = useCurrentSeason()

  const { data: athlete, isLoading: athleteLoading, error: athleteError, refetch } = useAthlete(athleteId)
  const { data: registrations = [], isLoading: registrationsLoading } = useAthleteRegistrations(athleteId)
  const { data: waivers = [] } = useWaivers(currentSeason?.id)
  const { data: waiverStatuses = [] } = useAthleteWaiverStatus(athleteId)
  const updateAthlete = useUpdateAthlete()

  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [signingWaiver, setSigningWaiver] = useState<{ id: string; title: string; body: string; required: boolean } | null>(null)

  useEffect(() => {
    if (athlete && !editingNotes) setNotesValue(athlete.medical_notes || '')
  }, [athlete, editingNotes])

  async function saveNotes() {
    if (!athlete) return
    try {
      await updateAthlete.mutateAsync({ athleteId: athlete.id, updates: { medical_notes: notesValue.trim() || null } })
      toast.success('Medical notes saved')
      setEditingNotes(false)
      refetch()
    } catch {
      toast.error('Failed to save medical notes')
    }
  }

  if (authLoading || athleteLoading) return <InlineLoading />
  if (athleteError) return <ErrorState error={athleteError} />
  if (!athlete) return <div className="text-sm text-muted-foreground py-12 text-center">Athlete not found.</div>

  const { age, category } = athlete.date_of_birth
    ? getAthleteCategory(athlete.date_of_birth, ageMethod, ageCategories)
    : { age: null, category: null }
  const initials = `${athlete.first_name.charAt(0)}${athlete.last_name.charAt(0)}`.toUpperCase()

  const requiredWaivers = (waivers as any[]).filter((w) => w.required && w.status === 'active')
  const signedWaiverIds = new Set((waiverStatuses as any[]).filter((s) => s.status === 'signed').map((s) => s.waiver_id))
  const allWaiversSigned = requiredWaivers.length === 0 || requiredWaivers.every((w) => signedWaiverIds.has(w.id))

  // Group registrations by season
  const regsBySeason = (registrations as Reg[]).reduce<Record<string, Reg[]>>((acc, reg) => {
    const key = reg.seasons?.name ?? 'Unknown Season'
    if (!acc[key]) acc[key] = []
    acc[key].push(reg)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-8">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push(`/clubs/${clubSlug}/parent/athletes`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeft className="h-4 w-4" /> Athletes
      </button>

      {/* Hero */}
      <div className="flex items-start gap-5">
        <div className="w-16 h-16 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
          <span className="text-foreground text-xl font-semibold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h1 className="page-title">{athlete.first_name} {athlete.last_name}</h1>
            <Link href={`/clubs/${clubSlug}/parent/programs`} className="flex-shrink-0">
              <Button size="sm">
                <BookOpen className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Browse Programs</span>
                <span className="sm:hidden">Programs</span>
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {age !== null && (
              <>
                <span className="text-muted-foreground text-sm">
                  {age} years old
                  {athlete.date_of_birth && (
                    <> · Born {new Date(athlete.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</>
                  )}
                  {athlete.gender && <> · {athlete.gender}</>}
                </span>
                <span className="inline-flex items-center rounded-full bg-orange-950/30 px-2.5 py-0.5 text-xs font-semibold text-orange-400">
                  {category}
                </span>
              </>
            )}
            {age === null && <span className="text-muted-foreground text-sm">Age unknown{athlete.gender && ` · ${athlete.gender}`}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 min-w-0">

        {/* Left col */}
        <div className="flex flex-col gap-4">

          {/* Waivers */}
          {requiredWaivers.length > 0 && (
            <div className="rounded-xl border bg-card p-5 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                {allWaiversSigned
                  ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                  : <AlertCircle className="h-4 w-4 text-orange-500" />}
                <h2 className="font-semibold">Waivers</h2>
              </div>
              <div className="space-y-2">
                {requiredWaivers.map((w: any) => {
                  const signed = signedWaiverIds.has(w.id)
                  return (
                    <div key={w.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground truncate min-w-0">{w.title}</span>
                      {signed ? (
                        <span className="flex items-center gap-1 text-xs text-green-400 flex-shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> Signed
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-2 text-xs border-orange-700 text-orange-400 hover:bg-orange-950/30 flex-shrink-0"
                          onClick={() => setSigningWaiver(w)}
                        >
                          <PenLine className="h-3 w-3" /> Sign
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Emergency contact */}
          {(household?.emergency_contact_name || household?.emergency_contact_phone) && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold mb-3">Emergency Contact</h2>
              <div className="space-y-1.5">
                {household.emergency_contact_name && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <User className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                    {household.emergency_contact_name}
                  </div>
                )}
                {household.emergency_contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Phone className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                    {household.emergency_contact_phone}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical notes */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Medical Notes</h2>
              {!editingNotes && (
                <button
                  type="button"
                  onClick={() => setEditingNotes(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-3 w-3" />
                  {athlete.medical_notes ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-3">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Allergies, medications, medical conditions…"
                  rows={5}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNotes} disabled={updateAthlete.isPending}>
                    <Save className="h-3 w-3 mr-1" />
                    {updateAthlete.isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : athlete.medical_notes ? (
              <p className="text-sm whitespace-pre-wrap text-foreground">{athlete.medical_notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No medical notes on file.</p>
            )}
          </div>
        </div>

        {/* Right col: Registrations by season */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm overflow-hidden">
            <h2 className="font-semibold mb-4">
              Program Registrations
              {registrations.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({registrations.length})
                </span>
              )}
            </h2>

            {registrationsLoading ? (
              <InlineLoading />
            ) : registrations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">No registrations yet.</p>
                <Link href={`/clubs/${clubSlug}/parent/programs`}>
                  <Button variant="outline" size="sm">Browse Programs</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(regsBySeason)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([seasonName, regs]) => (
                    <div key={seasonName}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {seasonName}
                      </p>
                      <div className="space-y-2">
                        {regs.map((reg) => <RegRow key={reg.id} reg={reg} />)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Waiver sign dialog */}
      {signingWaiver && profile && (
        <WaiverSignDialog
          open
          onOpenChange={(open) => !open && setSigningWaiver(null)}
          waiver={signingWaiver}
          athlete={athlete}
          guardianId={profile.id}
          guardianName={`${profile.first_name} ${profile.last_name}`}
          onSignatureComplete={() => setSigningWaiver(null)}
        />
      )}
    </div>
  )
}
