'use client'

import { useEffect, useState } from 'react'
import { useSystemAdmin } from '@/lib/use-system-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Check, Clock, Users } from 'lucide-react'

type ClubRequest = {
  id: string
  contact_name: string
  contact_email: string
  club_name: string
  slug_requested: string | null
  athlete_count_estimate: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export default function ClubRequestsPage() {
  const { loading: authLoading } = useSystemAdmin()
  const [requests, setRequests] = useState<ClubRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending')

  // Approve dialog state
  const [approving, setApproving] = useState<ClubRequest | null>(null)
  const [approveSlug, setApproveSlug] = useState('')
  const [approveClubName, setApproveClubName] = useState('')
  const [approveLoading, setApproveLoading] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  async function loadRequests(status: 'pending' | 'approved') {
    setLoading(true)
    try {
      const resp = await fetch(`/api/system-admin/club-requests?status=${status}`, { credentials: 'include' })
      const data = await resp.json()
      setRequests(data.requests ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) loadRequests(activeTab)
  }, [authLoading, activeTab])

  function openApprove(req: ClubRequest) {
    setApproving(req)
    setApproveClubName(req.club_name)
    setApproveSlug(req.slug_requested || req.club_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    setApproveError(null)
  }

  async function handleApprove() {
    if (!approving) return
    setApproveLoading(true)
    setApproveError(null)

    try {
      const resp = await fetch(`/api/system-admin/club-requests/${approving.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: approveSlug, clubName: approveClubName }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to approve')
      setApproving(null)
      loadRequests(activeTab)
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setApproveLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Club Requests</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Review and approve new club setup requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {(['pending', 'approved'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-orange-500 text-foreground'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab}
            {tab === 'pending' && requests.length > 0 && activeTab === 'pending' && (
              <span className="ml-2 rounded-full bg-orange-600 px-1.5 py-0.5 text-xs text-white">
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-zinc-400 text-sm py-8 text-center">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center">
          <Building2 className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No {activeTab} requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{req.club_name}</h3>
                    <Badge variant={req.status === 'pending' ? 'outline' : 'secondary'} className="text-xs">
                      {req.status === 'pending' ? (
                        <><Clock className="h-3 w-3 mr-1" />Pending</>
                      ) : (
                        <><Check className="h-3 w-3 mr-1" />Approved</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-300">{req.contact_name}</p>
                  <p className="text-sm text-zinc-500">{req.contact_email}</p>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-zinc-500">
                    {req.athlete_count_estimate && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {req.athlete_count_estimate} athletes
                      </span>
                    )}
                    {req.slug_requested && (
                      <span className="font-mono">/{req.slug_requested}</span>
                    )}
                    <span>{new Date(req.created_at).toLocaleDateString()}</span>
                  </div>
                  {req.notes && (
                    <p className="mt-2 text-xs text-zinc-400 bg-zinc-800 rounded-md px-3 py-2 max-w-lg">
                      {req.notes}
                    </p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <Button size="sm" onClick={() => openApprove(req)} className="flex-shrink-0">
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve dialog */}
      {approving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground mb-1">Approve club request</h2>
            <p className="text-sm text-zinc-400 mb-5">Review the details before provisioning the club.</p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-300">Club name</label>
                <input
                  type="text"
                  value={approveClubName}
                  onChange={e => setApproveClubName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-zinc-300">URL slug</label>
                <div className="flex items-center gap-0">
                  <span className="rounded-l-lg border border-r-0 border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-500">/clubs/</span>
                  <input
                    type="text"
                    value={approveSlug}
                    onChange={e => setApproveSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 rounded-r-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <p className="text-xs text-zinc-500">Dashboard will be at /clubs/{approveSlug}/admin</p>
              </div>

              <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs text-zinc-400 space-y-1">
                <p><span className="text-zinc-300">Contact:</span> {approving.contact_name} · {approving.contact_email}</p>
                {approving.athlete_count_estimate && <p><span className="text-zinc-300">Athletes:</span> {approving.athlete_count_estimate}</p>}
                {approving.notes && <p><span className="text-zinc-300">Notes:</span> {approving.notes}</p>}
              </div>
            </div>

            {approveError && (
              <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
                {approveError}
              </div>
            )}

            <div className="mt-5 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setApproving(null)} disabled={approveLoading}>
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={approveLoading || !approveSlug || !approveClubName}>
                {approveLoading ? 'Provisioning…' : 'Approve & create club'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
