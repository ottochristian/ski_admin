'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, CreditCard, AlertCircle,
} from 'lucide-react'
import { useRequireAdmin } from '@/lib/auth-context'
import { AdminPageHeader } from '@/components/admin-page-header'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCurrentSeason } from '@/lib/contexts/season-context'
import { cn } from '@/lib/utils'

interface AthleteRow {
  id: string
  first_name: string | null
  last_name: string | null
  category: string | null
  program_name: string | null
  sub_program_name: string | null
  payment_status: string | null
  waiver_signed: boolean | null
  guardian_name: string | null
  guardian_phone: string | null
}

function useRichAthletes(page: number, search: string, seasonId: string | null) {
  return useQuery<{ athletes: AthleteRow[]; totalCount: number; totalPages: number; currentPage: number }>({
    queryKey: ['athletes-rich', page, search, seasonId],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) })
      if (search.length >= 2) params.set('q', search)
      if (seasonId) params.set('season_id', seasonId)
      const res = await fetch(`/api/admin/athletes/list?${params}`)
      if (!res.ok) throw new Error('Failed to load athletes')
      return res.json()
    },
  })
}

function PaymentBadge({ status }: { status: string | null }) {
  if (!status) return null
  if (status === 'paid') return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-emerald-950/30 text-emerald-400 ring-1 ring-inset ring-emerald-800/40">
      <CreditCard className="h-3 w-3" /> Paid
    </span>
  )
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-yellow-950/30 text-yellow-400 ring-1 ring-inset ring-yellow-800/40">
      <Clock className="h-3 w-3" /> Pending
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-red-950/30 text-red-400 ring-1 ring-inset ring-red-800/40">
      <AlertCircle className="h-3 w-3" /> Unpaid
    </span>
  )
}

function WaiverBadge({ signed }: { signed: boolean | null }) {
  if (signed === null) return null
  if (signed) return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-emerald-950/30 text-emerald-400 ring-1 ring-inset ring-emerald-800/40">
      <CheckCircle className="h-3 w-3" /> Waiver
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-red-950/30 text-red-400 ring-1 ring-inset ring-red-800/40">
      <XCircle className="h-3 w-3" /> No waiver
    </span>
  )
}

export default function AthletesPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, loading: authLoading } = useRequireAdmin()
  const basePath = `/clubs/${clubSlug}/admin`
  const currentSeason = useCurrentSeason()

  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const { data, isLoading, error, refetch } = useRichAthletes(
    currentPage, debouncedSearch, currentSeason?.id ?? null
  )

  const athletes = data?.athletes ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 0

  if (authLoading) return <InlineLoading message="Loading…" />
  if (!profile) return null

  const startIndex = (currentPage - 1) * 50 + 1
  const endIndex = Math.min(currentPage * 50, totalCount)

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Athletes"
        description="Manage all registered athletes"
        action={
          <Button size="sm" asChild>
            <Link href={`${basePath}/athletes/new`}>
              <Plus className="h-3.5 w-3.5" />
              Add Athlete
            </Link>
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">All Athletes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{totalCount.toLocaleString()} total</p>
          </div>
          <div className="relative w-56 flex-shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search athletes…"
              className="pl-8 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="p-2">
          {isLoading ? (
            <InlineLoading message="Loading athletes…" />
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : athletes.length > 0 ? (
            <>
              <div className="space-y-0.5">
                {athletes.map((athlete) => {
                  const first = athlete.first_name ?? ''
                  const last = athlete.last_name ?? ''
                  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?'

                  return (
                    <Link
                      key={athlete.id}
                      href={`${basePath}/athletes/${athlete.id}`}
                      className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-secondary/50 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-muted-foreground">{initials}</span>
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">
                            {first} {last}
                          </p>
                          {athlete.category && (
                            <span className="text-xs text-muted-foreground">{athlete.category}</span>
                          )}
                        </div>

                        {/* Program line */}
                        {(athlete.program_name || athlete.sub_program_name) && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {athlete.program_name}
                            {athlete.program_name && athlete.sub_program_name && (
                              <span className="text-zinc-600"> · </span>
                            )}
                            {athlete.sub_program_name}
                          </p>
                        )}

                        {/* Guardian line */}
                        {athlete.guardian_name && (
                          <p className="text-xs text-zinc-600 mt-0.5">
                            {athlete.guardian_name}
                            {athlete.guardian_phone && (
                              <span className="ml-2 text-zinc-700">{athlete.guardian_phone}</span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Status badges */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end mt-0.5">
                        <WaiverBadge signed={athlete.waiver_signed} />
                        <PaymentBadge status={athlete.payment_status} />
                      </div>
                    </Link>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border px-2">
                  <div className="text-xs text-muted-foreground">
                    {startIndex.toLocaleString()}–{endIndex.toLocaleString()} of {totalCount.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {searchTerm ? `No athletes found matching "${searchTerm}"` : 'No athletes found'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
