'use client'

import { useMemo, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import RevenuePage from '../analytics/revenue/page'
import WaiversPage from '../analytics/waivers/page'
import { Award, DollarSign, Settings2, Target, TrendingUp, Users, UserPlus, Home } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin-page-header'
import { ClubIntelligenceWidget } from '@/components/club-intelligence-widget'
import { useRequireAdmin } from '@/lib/auth-context'
import { useClub } from '@/lib/club-context'
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useAthleteSummary,
  useAthletesByProgram,
  useAthletesByGender,
  useAthletesByAge,
} from '@/lib/hooks/use-athletes'
import { useProgramsAnalytics } from '@/lib/hooks/use-program-analytics'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  CHART_PALETTE, CHART_COLORS, GRID_PROPS, AXIS_STYLE, TOOLTIP_STYLE, LEGEND_STYLE,
} from '@/lib/chart-theme'

const TABS = [
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'athletes', label: 'Athletes' },
  { id: 'programs', label: 'Programs' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'waivers', label: 'Waivers' },
  { id: 'custom', label: 'Custom Reports' },
] as const

type TabId = typeof TABS[number]['id']

const INTELLIGENCE_CHIPS = [
  { label: "Who hasn't paid?", q: 'Which athletes have unpaid registrations?' },
  { label: 'Missing waivers', q: 'Which athletes are missing required waivers?' },
  { label: 'Revenue by program', q: 'Show me revenue broken down by program this season' },
  { label: 'Enrollment trends', q: 'Which programs have grown or declined vs last season?' },
  { label: 'Low-enrollment programs', q: 'Which programs are below 60% capacity?' },
  { label: 'Coach activity', q: "Which coaches haven't sent any messages this season?" },
]

type SortOption = 'name' | 'enrollment' | 'revenue' | 'enrollmentRate'

// ── Athletes Tab ────────────────────────────────────────────────────────────

function AthletesTab({ clubId }: { clubId: string }) {
  const filters = { programId: 'all', gender: 'all' }
  const { data: summary, isLoading: summaryLoading } = useAthleteSummary(clubId, filters)
  const { data: byProgram, isLoading: byProgramLoading } = useAthletesByProgram(clubId, filters)
  const { data: byGender, isLoading: byGenderLoading } = useAthletesByGender(clubId, filters)
  const { data: byAge, isLoading: byAgeLoading } = useAthletesByAge(clubId, filters)

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Athletes', value: summary?.totalAthletes, sub: 'Enrolled this season', icon: Users, color: 'text-orange-500' },
          { label: 'New Athletes', value: summary?.newAthletes, sub: 'First time this season', icon: UserPlus, color: 'text-green-500' },
          { label: 'Returning', value: summary?.returningAthletes, sub: 'From previous season', icon: TrendingUp, color: 'text-purple-500' },
          { label: 'Households', value: summary?.uniqueHouseholds, sub: 'Unique families', icon: Home, color: 'text-amber-500' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="h-8 w-20 bg-secondary rounded animate-pulse" />
              ) : (
                <>
                  <div className={`metric-value ${color}`}>{value ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Athletes by Program</CardTitle>
            <CardDescription>Total enrollment per program</CardDescription>
          </CardHeader>
          <CardContent>
            {byProgramLoading ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
            ) : !byProgram?.programs?.length ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byProgram.programs}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="programName" angle={-45} textAnchor="end" height={100} {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="athleteCount" fill={CHART_COLORS.primary} name="Athletes" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
            <CardDescription>Athlete breakdown by gender</CardDescription>
          </CardHeader>
          <CardContent>
            {byGenderLoading ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
            ) : !byGender?.distribution?.length ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={byGender.distribution} dataKey="count" nameKey="gender" cx="50%" cy="50%" outerRadius={100} label>
                    {byGender.distribution.map((_: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Age Group Distribution</CardTitle>
          <CardDescription>Athletes by age group</CardDescription>
        </CardHeader>
        <CardContent>
          {byAgeLoading ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
          ) : !byAge?.distribution?.length ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byAge.distribution}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="ageGroup" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={CHART_COLORS.primary} name="Athletes" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Programs Tab ─────────────────────────────────────────────────────────────

function ProgramsTab({ clubId, seasonId }: { clubId: string; seasonId: string | null }) {
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const { data, isLoading } = useProgramsAnalytics(clubId, seasonId)
  const summary = data?.summary
  const programs = data?.programs || []

  const sortedPrograms = useMemo(() => {
    const sorted = [...programs]
    switch (sortBy) {
      case 'enrollment': return sorted.sort((a, b) => b.currentEnrollment - a.currentEnrollment)
      case 'revenue': return sorted.sort((a, b) => b.revenue - a.revenue)
      case 'enrollmentRate': return sorted.sort((a, b) => (b.enrollmentRate ?? -1) - (a.enrollmentRate ?? -1))
      default: return sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [programs, sortBy])

  const enrollmentChartData = useMemo(() => sortedPrograms.map(p => ({
    name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
    enrolled: p.currentEnrollment,
    remaining: p.maxCapacity ? Math.max(0, p.maxCapacity - p.currentEnrollment) : 0,
  })), [sortedPrograms])

  const revenueChartData = useMemo(() => sortedPrograms
    .filter(p => p.revenue > 0)
    .map(p => ({ name: p.name.length > 25 ? p.name.substring(0, 25) + '...' : p.name, value: p.revenue })),
  [sortedPrograms])

  const getEnrollmentColor = (rate: number | null) =>
    rate === null ? 'text-gray-600' : rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-600' : 'text-red-600'
  const getEnrollmentBgColor = (rate: number | null) =>
    rate === null ? 'bg-gray-100' : rate >= 80 ? 'bg-green-600' : rate >= 60 ? 'bg-yellow-600' : 'bg-red-600'

  const exportToCSV = () => {
    const headers = ['Program', 'Enrollment', 'Capacity', 'Rate %', 'Revenue']
    const rows = sortedPrograms.map(p => [
      p.name, p.currentEnrollment, p.maxCapacity || 'Unlimited',
      p.enrollmentRate !== null ? `${p.enrollmentRate}%` : 'N/A',
      `$${p.revenue.toFixed(2)}`,
    ])
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'programs-analytics.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Program performance, enrollment, and revenue analytics</p>
        <Button size="sm" onClick={exportToCSV} disabled={isLoading || programs.length === 0}>Export CSV</Button>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total Programs', value: summary?.totalPrograms, sub: 'Active this season', icon: Target, color: 'text-blue-500' },
          { label: 'Avg Enrollment', value: summary?.avgEnrollmentRate !== null ? `${summary?.avgEnrollmentRate}%` : 'N/A', sub: 'Capacity utilization', icon: TrendingUp, color: 'text-purple-500' },
          { label: 'Most Popular', value: summary?.mostPopularProgram?.enrollment ?? 0, sub: summary?.mostPopularProgram?.name || 'N/A', icon: Award, color: 'text-yellow-500' },
          { label: 'Total Revenue', value: `$${(summary?.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`, sub: 'All programs', icon: DollarSign, color: 'text-green-500' },
          { label: 'Avg Rev/Program', value: `$${(summary?.avgRevenuePerProgram || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`, sub: 'Per program average', icon: Users, color: 'text-indigo-500' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-20 bg-secondary rounded animate-pulse" />
              ) : (
                <>
                  <div className={`metric-value ${color}`}>{value}</div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enrollment vs Capacity</CardTitle>
            <CardDescription>Current enrollment and remaining capacity by program</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : !enrollmentChartData.length ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground">No program data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={enrollmentChartData}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend {...LEGEND_STYLE} />
                  <Bar dataKey="enrolled" stackId="a" fill={CHART_COLORS.primary} name="Enrolled" />
                  <Bar dataKey="remaining" stackId="a" fill={CHART_COLORS.grid} name="Remaining" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
            <CardDescription>Revenue breakdown by program</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : !revenueChartData.length ? (
              <div className="h-80 flex items-center justify-center text-muted-foreground">No revenue data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={revenueChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                    label={(e) => `$${(e.value / 1000).toFixed(1)}k`} labelLine={false}>
                    {revenueChartData.map((_: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Legend {...LEGEND_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Program table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Program Performance</CardTitle>
              <CardDescription>Detailed metrics for each program</CardDescription>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border rounded-md px-3 py-1.5 bg-background border-zinc-700"
            >
              <option value="name">Sort by Name</option>
              <option value="enrollment">Sort by Enrollment</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="enrollmentRate">Sort by Rate</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-secondary animate-pulse" />)}
            </div>
          ) : !sortedPrograms.length ? (
            <div className="text-center py-12 text-muted-foreground">No programs found for this season</div>
          ) : (
            <div className="space-y-4">
              {sortedPrograms.map((program) => {
                const rate = program.enrollmentRate
                const isFull = rate !== null && rate >= 100
                const isLow = rate !== null && rate < 60
                return (
                  <div key={program.id} className="border border-zinc-800 rounded-lg p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{program.name}</h3>
                          {isFull && <Badge variant="destructive">Full</Badge>}
                          {isLow && <Badge variant="outline" className="text-yellow-500 border-yellow-600">Low Enrollment</Badge>}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">${program.pricePerPerson.toFixed(2)} per athlete</p>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-semibold text-green-400">
                          ${program.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-zinc-500">Total Revenue</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-zinc-400">Enrollment: {program.currentEnrollment} / {program.maxCapacity || '∞'}</span>
                        {rate !== null && <span className={`font-semibold ${getEnrollmentColor(rate)}`}>{rate}%</span>}
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div className={`h-2 rounded-full ${getEnrollmentBgColor(rate)}`}
                          style={{ width: `${Math.min(rate || 0, 100)}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 pt-2 border-t border-zinc-800 text-xs">
                      <div><p className="text-zinc-500">Paid</p><p className="font-semibold text-green-400">{program.paidCount}</p></div>
                      <div><p className="text-zinc-500">Unpaid</p><p className="font-semibold text-red-400">{program.unpaidCount}</p></div>
                      <div><p className="text-zinc-500">Total</p><p className="font-semibold text-foreground">{program.currentEnrollment}</p></div>
                      <div><p className="text-zinc-500">Avg Rev/Athlete</p><p className="font-semibold text-foreground">${program.avgRevenuePerAthlete.toFixed(0)}</p></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Placeholder tabs ──────────────────────────────────────────────────────────

function ComingSoonTab({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 px-6 py-16 text-center">
      <Icon className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">{description}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminInsightsPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, loading: authLoading } = useRequireAdmin()
  const { club } = useClub()
  const selectedSeason = useSelectedSeason()
  const [activeTab, setActiveTab] = useState<TabId>('intelligence')

  if (authLoading || !profile) return null

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Insights"
        description="AI-powered intelligence and analytics for your club."
      />

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-zinc-800 -mb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-orange-500 text-foreground'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {activeTab === 'intelligence' && (
          <ClubIntelligenceWidget
            summaryEndpoint="/api/admin/ai/insights"
            chatEndpoint="/api/admin/ai/insights/chat"
            chips={INTELLIGENCE_CHIPS}
            title="Club Intelligence"
          />
        )}

        {activeTab === 'athletes' && club?.id && (
          <AthletesTab clubId={club.id} />
        )}

        {activeTab === 'programs' && club?.id && (
          <ProgramsTab clubId={club.id} seasonId={selectedSeason?.id ?? null} />
        )}

        {activeTab === 'revenue' && (
          <Suspense fallback={<div className="py-12 text-center text-sm text-zinc-500 animate-pulse">Loading revenue…</div>}>
            <RevenuePage />
          </Suspense>
        )}

        {activeTab === 'waivers' && (
          <Suspense fallback={<div className="py-12 text-center text-sm text-zinc-500 animate-pulse">Loading waivers…</div>}>
            <WaiversPage />
          </Suspense>
        )}

        {activeTab === 'custom' && (
          <ComingSoonTab
            icon={Settings2}
            title="Custom Reports"
            description="Build custom reports by choosing data sources, dimensions, metrics, and visualizations. Coming soon."
          />
        )}
      </div>
    </div>
  )
}
