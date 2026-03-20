'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  FileText,
  DollarSign,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Circle,
  Lock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { useRequireAdmin } from '@/lib/auth-context'
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { useAthletesCount } from '@/lib/hooks/use-athletes'
import {
  useRegistrationsCount,
  useTotalRevenue,
  useRecentRegistrations,
} from '@/lib/hooks/use-registrations'
import { useSeasonReadiness } from '@/lib/hooks/use-season-readiness'
import { InlineLoading } from '@/components/ui/loading-states'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { GreetingWidget } from '@/components/greeting-widget'
import { DashboardHeroChat } from '@/components/dashboard-hero-chat'
import { useImpersonation } from '@/lib/use-impersonation'

function statusDot(status: string) {
  switch (status?.toLowerCase()) {
    case 'confirmed':  return 'bg-emerald-400'
    case 'pending':    return 'bg-amber-400'
    case 'waitlisted': return 'bg-zinc-500'
    case 'cancelled':  return 'bg-red-400'
    default:           return 'bg-zinc-500'
  }
}

function statusLabel(status: string) {
  switch (status?.toLowerCase()) {
    case 'confirmed':  return 'text-emerald-300'
    case 'pending':    return 'text-amber-300'
    case 'waitlisted': return 'text-zinc-400'
    case 'cancelled':  return 'text-red-300'
    default:           return 'text-zinc-400'
  }
}

export default function AdminDashboard() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, loading: authLoading } = useRequireAdmin()
  const selectedSeason = useSelectedSeason()
  const impCtx = useImpersonation()
  const displayFirstName = impCtx ? (impCtx.userName.split(' ')[0] || impCtx.userName) : (profile?.first_name ?? '')
  const [aiEnabled, setAiEnabled] = useState(false)

  const [weeklyDeltas, setWeeklyDeltas] = useState<{
    newAthletes: number
    newRevenue: number
    newRegistrations: number
    prevAthletes: number
    prevRevenue: number
    prevRegistrations: number
  } | null>(null)

  const [actionItems, setActionItems] = useState<Array<{
    level: 'red' | 'amber'
    message: string
    href: string
  }>>([])

  const [waiverStats, setWaiverStats] = useState<{ signed: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/ai/toggle')
      .then(r => r.json())
      .then(data => setAiEnabled(data.ai_enabled && data.ai_insights_enabled))
      .catch(() => {})
  }, [])

  // Fetch weekly deltas
  useEffect(() => {
    if (!profile?.club_id || !selectedSeason?.id) return
    const supabase = createClient()
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    async function fetchDeltas() {
      const [regsCurrent, regsPrior, ordersCurrent, ordersPrior] = await Promise.all([
        supabase
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', profile!.club_id)
          .eq('season_id', selectedSeason!.id)
          .gte('created_at', weekAgo.toISOString()),
        supabase
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', profile!.club_id)
          .eq('season_id', selectedSeason!.id)
          .gte('created_at', twoWeeksAgo.toISOString())
          .lt('created_at', weekAgo.toISOString()),
        supabase
          .from('orders')
          .select('total_amount')
          .eq('club_id', profile!.club_id)
          .eq('season_id', selectedSeason!.id)
          .eq('status', 'paid')
          .gte('created_at', weekAgo.toISOString()),
        supabase
          .from('orders')
          .select('total_amount')
          .eq('club_id', profile!.club_id)
          .eq('season_id', selectedSeason!.id)
          .eq('status', 'paid')
          .gte('created_at', twoWeeksAgo.toISOString())
          .lt('created_at', weekAgo.toISOString()),
      ])

      const newRegs = regsCurrent.count ?? 0
      const prevRegs = regsPrior.count ?? 0
      const newRev = (ordersCurrent.data ?? []).reduce((s: number, o: any) => s + (o.total_amount ?? 0), 0)
      const prevRev = (ordersPrior.data ?? []).reduce((s: number, o: any) => s + (o.total_amount ?? 0), 0)

      setWeeklyDeltas({
        newAthletes: newRegs,
        newRevenue: newRev,
        newRegistrations: newRegs,
        prevAthletes: prevRegs,
        prevRevenue: prevRev,
        prevRegistrations: prevRegs,
      })
    }

    fetchDeltas().catch(() => {})
  }, [profile?.club_id, selectedSeason?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch action items
  useEffect(() => {
    if (!profile?.club_id || !selectedSeason?.id) return
    const supabase = createClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const basePath = `/clubs/${clubSlug}/admin`

    async function fetchActionItems() {
      const items: Array<{ level: 'red' | 'amber'; message: string; href: string }> = []

      const [failedOrders, upcomingRaces, unpaidRegs] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', profile!.club_id)
          .eq('status', 'failed')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', profile!.club_id)
          .eq('event_type', 'race')
          .lte('start_at', sevenDaysFromNow.toISOString())
          .gte('start_at', new Date().toISOString()),
        supabase
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', profile!.club_id)
          .eq('season_id', selectedSeason!.id)
          .neq('payment_status', 'paid'),
      ])

      const failedCount = failedOrders.count ?? 0
      const raceCount = upcomingRaces.count ?? 0
      const unpaidCount = unpaidRegs.count ?? 0

      if (failedCount > 0) {
        items.push({
          level: 'red',
          message: `${failedCount} failed payment${failedCount === 1 ? '' : 's'} in the last 30 days`,
          href: `${basePath}/registrations?filter=failed`,
        })
      }

      if (raceCount > 0 && unpaidCount > 0) {
        items.push({
          level: 'amber',
          message: `${unpaidCount} unpaid registration${unpaidCount === 1 ? '' : 's'} with races coming up this week`,
          href: `${basePath}/registrations?filter=unpaid`,
        })
      }

      setActionItems(items)
    }

    fetchActionItems().catch(() => {})
  }, [profile?.club_id, selectedSeason?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch waiver stats
  useEffect(() => {
    if (!profile?.club_id || !selectedSeason?.id) return
    const supabase = createClient()
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('waiver_signatures')
          .select('athlete_id, waivers!inner(club_id, season_id, required)')
          .eq('waivers.club_id', profile.club_id)
          .eq('waivers.season_id', selectedSeason.id)
          .eq('waivers.required', true)
        if (error) {
          console.error('[WaiverStats] query error:', error.message)
          setWaiverStats({ signed: 0 })
          return
        }
        const unique = new Set((data ?? []).map((r: { athlete_id: string }) => r.athlete_id))
        setWaiverStats({ signed: unique.size })
      } catch (err) {
        console.error('[WaiverStats] unexpected error:', err)
        setWaiverStats({ signed: 0 })
      }
    })()
  }, [profile?.club_id, selectedSeason?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: totalAthletes = 0, isLoading: athletesLoading } = useAthletesCount(
    profile?.club_id || null,
    selectedSeason?.id || null
  )

  const { data: totalRegistrations = 0, isLoading: registrationsLoading } =
    useRegistrationsCount(selectedSeason?.id)
  const { data: totalRevenue = 0, isLoading: revenueLoading } = useTotalRevenue(selectedSeason?.id)
  const { data: recentRegistrations = [], isLoading: recentRegsLoading } =
    useRecentRegistrations(selectedSeason?.id || null, 8)

  const { data: readiness } = useSeasonReadiness(
    selectedSeason?.status === 'draft' ? selectedSeason?.id : null
  )

  const transformedRecentRegs = recentRegistrations.map((reg: any) => ({
    ...reg,
    athlete: reg.athletes,
  }))

  if (!authLoading && !profile) return null

  if (!authLoading && !selectedSeason) {
    const onboardingSteps = [
      {
        label: 'Create your first season',
        description: 'Define the date range and name for your upcoming season',
        href: `/clubs/${clubSlug}/admin/settings/seasons`,
        locked: false,
      },
      {
        label: 'Add programs',
        description: 'Create the programs athletes will register for',
        locked: true,
      },
      {
        label: 'Set pricing',
        description: 'Configure registration fees for each sub-program',
        locked: true,
      },
      {
        label: 'Open registration',
        description: 'Activate the season so parents can register their athletes',
        locked: true,
      },
    ]

    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Welcome to your club</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Let's get your first season set up so you can start accepting registrations.</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-foreground">Getting started</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Complete these steps to open registration</p>
          </div>
          <div className="divide-y divide-zinc-800">
            {onboardingSteps.map((step, idx) => (
              <div key={idx} className={`flex items-start gap-4 px-5 py-4 ${step.locked ? 'opacity-40' : ''}`}>
                <div className="mt-0.5 flex-shrink-0">
                  {step.locked
                    ? <Lock className="w-4 h-4 text-zinc-300" />
                    : <Circle className="w-4 h-4 text-zinc-300" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Step {idx + 1}</span>
                  <p className="text-sm font-medium text-foreground mt-0.5">{step.label}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{step.description}</p>
                </div>
                {!step.locked && step.href && (
                  <Link
                    href={step.href}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors mt-1"
                  >
                    Start
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const basePath = `/clubs/${clubSlug}/admin`

  function DeltaLine({ current, prev }: { current: number; prev: number }) {
    const diff = current - prev
    if (diff > 0) return (
      <span className="flex items-center gap-0.5 text-xs text-green-400">
        <TrendingUp className="h-3 w-3" />
        ↑ {diff} this week
      </span>
    )
    if (diff < 0) return (
      <span className="flex items-center gap-0.5 text-xs text-red-400">
        <TrendingDown className="h-3 w-3" />
        ↓ {Math.abs(diff)} this week
      </span>
    )
    return <span className="text-xs text-zinc-400">— same as last week</span>
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Hero — AI chat when enabled, plain greeting otherwise */}
      {aiEnabled ? (
        <DashboardHeroChat
          firstName={displayFirstName}
          chatEndpoint="/api/admin/ai/insights/chat"
        />
      ) : (
        <GreetingWidget firstName={displayFirstName} />
      )}

      {/* 2. Season Setup Banner — only when draft + incomplete */}
      {readiness && !readiness.isComplete && (
        <Link
          href={`${basePath}/settings/seasons/${selectedSeason?.id}/setup`}
          className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 hover:bg-amber-100/60 transition-colors group"
        >
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-amber-800">
              Season setup in progress —{' '}
            </span>
            <span className="text-sm text-amber-700">
              {readiness.completedCount} of {readiness.totalCount} steps complete
            </span>
          </div>
          <span className="text-xs font-medium text-amber-600 group-hover:text-amber-700 flex items-center gap-1 flex-shrink-0">
            View checklist
            <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      )}

      {/* 4. Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800 rounded-xl overflow-hidden ring-1 ring-zinc-800">
        {/* Athletes */}
        <div className="bg-zinc-900 px-5 py-5">
          <div className="flex items-start justify-between mb-4">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Athletes</span>
            <Users className="h-3.5 w-3.5 text-zinc-600 mt-0.5" />
          </div>
          {athletesLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-zinc-800" />
          ) : (
            <p className="metric-value text-foreground">
              {totalAthletes.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-zinc-400 mt-2">enrolled this season</p>
          {weeklyDeltas && (
            <div className="mt-1.5">
              <DeltaLine current={weeklyDeltas.newAthletes} prev={weeklyDeltas.prevAthletes} />
            </div>
          )}
        </div>

        {/* Waivers */}
        <div className="bg-zinc-900 px-5 py-5">
          <div className="flex items-start justify-between mb-4">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Waivers</span>
            <FileText className="h-3.5 w-3.5 text-zinc-600 mt-0.5" />
          </div>
          {waiverStats === null ? (
            <div className="h-8 w-16 animate-pulse rounded bg-zinc-800" />
          ) : (
            <p className="metric-value text-foreground">{waiverStats.signed}</p>
          )}
          <p className="text-xs text-zinc-400 mt-2">
            {waiverStats !== null && totalAthletes > 0
              ? `of ${totalAthletes} athletes signed`
              : 'required waivers signed'}
          </p>
        </div>

        {/* Registrations */}
        <div className="bg-zinc-900 px-5 py-5">
          <div className="flex items-start justify-between mb-4">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Registrations</span>
            <FileText className="h-3.5 w-3.5 text-zinc-600 mt-0.5" />
          </div>
          {registrationsLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-zinc-800" />
          ) : (
            <p className="metric-value text-foreground">
              {totalRegistrations.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-zinc-400 mt-2">total this season</p>
          {weeklyDeltas && (
            <div className="mt-1.5">
              <DeltaLine current={weeklyDeltas.newRegistrations} prev={weeklyDeltas.prevRegistrations} />
            </div>
          )}
        </div>

        {/* Revenue */}
        <div className="bg-zinc-900 px-5 py-5">
          <div className="flex items-start justify-between mb-4">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Revenue</span>
            <DollarSign className="h-3.5 w-3.5 text-zinc-600 mt-0.5" />
          </div>
          {revenueLoading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-zinc-800" />
          ) : (
            <p className="metric-value text-foreground">
              ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          )}
          <p className="text-xs text-zinc-400 mt-2">collected this season</p>
          {weeklyDeltas && (
            <div className="mt-1.5">
              <DeltaLine
                current={weeklyDeltas.newRevenue}
                prev={weeklyDeltas.prevRevenue}
              />
            </div>
          )}
        </div>
      </div>

      {/* 5. Action Items Bar — only when items exist */}
      {actionItems.length > 0 && (
        <div className="flex flex-col gap-2">
          {actionItems.map((item, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                item.level === 'red'
                  ? 'border-red-800/60 bg-red-950/50 text-red-200'
                  : 'border-orange-800/50 bg-orange-950/30 text-orange-200'
              )}
            >
              {item.level === 'red'
                ? <AlertCircle className="h-4 w-4 flex-shrink-0" />
                : <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              }
              <span className="flex-1 text-sm">{item.message}</span>
              <Link
                href={item.href}
                className={cn(
                  'flex-shrink-0 text-xs font-medium flex items-center gap-1',
                  item.level === 'red'
                    ? 'text-red-300 hover:text-red-200'
                    : 'text-orange-300 hover:text-orange-200'
                )}
              >
                → View
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* 6. Activity Feed — full width */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Latest athlete enrollments</p>
          </div>
          <Link
            href={`${basePath}/registrations`}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentRegsLoading ? (
          <div className="p-5">
            <InlineLoading message="Loading..." />
          </div>
        ) : transformedRecentRegs.length > 0 ? (
          <div className="divide-y divide-zinc-800">
            {transformedRecentRegs.map((reg: any) => {
              const first = reg.athlete?.first_name || ''
              const last = reg.athlete?.last_name || ''
              const initials = `${first[0] || ''}${last[0] || ''}`.toUpperCase() || '?'
              const programName = reg.sub_programs?.programs?.name || ''
              const subProgramName = reg.sub_programs?.name || ''
              const scopeLabel = [programName, subProgramName].filter(Boolean).join(' › ')
              const amount = reg.amount_paid ? `$${Number(reg.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : null

              return (
                <div
                  key={reg.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/60 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-semibold text-zinc-400">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {first} {last}
                    </p>
                    {scopeLabel && (
                      <p className="text-xs text-zinc-500 truncate">{scopeLabel}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {amount && (
                      <span className="text-xs font-medium text-zinc-300">{amount}</span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-1.5 h-1.5 rounded-full', statusDot(reg.status))} />
                      <span className={cn('text-xs font-medium capitalize', statusLabel(reg.status))}>
                        {reg.status}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-zinc-400">No registrations yet</p>
        )}
      </div>
    </div>
  )
}
