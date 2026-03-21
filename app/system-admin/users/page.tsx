'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSystemAdmin } from '@/lib/use-system-admin'
import { createClient } from '@/lib/supabase/client'
import { IMP_SESSION_KEY } from '@/lib/use-impersonation'

type UserRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type OnboardingStep =
  | 'active'
  | 'awaiting_otp'
  | 'otp_verified'
  | 'account_created'
  | 'setup_incomplete'

type UserRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  club_id: string | null
  club_name: string | null
  created_at: string
  last_sign_in_at: string | null
  onboarding_step: OnboardingStep
  has_household: boolean
}

type Club = { id: string; name: string; slug: string }

const ROLES: UserRole[] = ['parent', 'coach', 'admin', 'system_admin']

const roleBadge: Record<UserRole, string> = {
  parent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  coach: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  admin: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  system_admin: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusBadge: Record<OnboardingStep, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  awaiting_otp: { label: 'Awaiting OTP', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  otp_verified: { label: 'OTP Verified', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  account_created: { label: 'Account Created', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  setup_incomplete: { label: 'Setup Incomplete', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
}

function relativeTime(date: string | null): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export default function UsersPage() {
  const { profile, loading: authLoading } = useSystemAdmin()
  const [supabase] = useState(() => createClient())

  const [users, setUsers] = useState<UserRow[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  // Edit modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState<{
    first_name: string
    last_name: string
    email: string
    role: UserRole
    club_id: string
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/system-admin/users', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    const json = await resp.json()
    if (!resp.ok) { setError(json.error || 'Failed to load users'); setLoading(false); return }
    setUsers(json.users || [])
    setLoading(false)
  }, [supabase])

  const loadClubs = useCallback(async () => {
    const resp = await fetch('/api/clubs/public')
    const json = await resp.json()
    if (resp.ok) setClubs(json.clubs || [])
  }, [])

  useEffect(() => {
    if (!authLoading) {
      loadUsers()
      loadClubs()
    }
  }, [authLoading, loadUsers, loadClubs])

  async function handleImpersonate(userId: string) {
    setImpersonating(userId)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/system-admin/impersonate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ userId }),
    })
    const json = await resp.json()
    setImpersonating(null)
    if (resp.ok) {
      sessionStorage.setItem(IMP_SESSION_KEY, JSON.stringify(json.ctx))
      window.location.href = json.redirectUrl
    } else {
      showToast(json.error || 'Failed to impersonate', false)
    }
  }

  function openEdit(u: UserRow) {
    setEditUser(u)
    setEditForm({
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      email: u.email ?? '',
      role: u.role,
      club_id: u.club_id ?? '',
    })
  }

  function closeEdit() {
    setEditUser(null)
    setEditForm(null)
  }

  async function handleSave() {
    if (!editUser || !editForm) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()

    // Only send fields that changed
    const body: Record<string, unknown> = {}
    if (editForm.first_name !== (editUser.first_name ?? '')) body.first_name = editForm.first_name
    if (editForm.last_name !== (editUser.last_name ?? '')) body.last_name = editForm.last_name
    if (editForm.email !== (editUser.email ?? '')) body.email = editForm.email
    if (editForm.role !== editUser.role) body.role = editForm.role
    if (editForm.club_id !== (editUser.club_id ?? '')) body.club_id = editForm.club_id || null

    const resp = await fetch(`/api/system-admin/users/${editUser.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const json = await resp.json()
    setSaving(false)
    if (resp.ok) {
      closeEdit()
      showToast('User updated successfully', true)
      await loadUsers()
    } else {
      showToast(json.error || 'Failed to update user', false)
    }
  }

  function showToast(message: string, ok: boolean) {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = users.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      u.email.toLowerCase().includes(q) ||
      `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase().includes(q)
    return matchesRole && matchesSearch
  })

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-zinc-400">Loading users…</p></div>
  }

  if (error) {
    return <div className="flex items-center justify-center py-12"><p className="text-red-400">{error}</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">All Users</h1>
        <p className="text-sm text-zinc-400 mt-0.5">View and manage every user in the platform</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as UserRole | 'all')}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <p className="text-sm font-semibold text-foreground">{filtered.length} users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Club</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Joined</th>
                <th className="px-5 py-3 text-left">Last Seen</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-zinc-500">No users found</td></tr>
              ) : filtered.map(u => {
                const status = statusBadge[u.onboarding_step] ?? statusBadge.account_created
                return (
                  <tr key={u.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">
                      {u.first_name || u.last_name
                        ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                        : <span className="text-zinc-500">—</span>}
                    </td>
                    <td className="px-5 py-3 text-zinc-300">{u.email}</td>
                    <td className="px-5 py-3 text-zinc-400">{u.club_name ?? <span className="text-zinc-600">—</span>}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadge[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {relativeTime(u.last_sign_in_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(u)}
                          disabled={u.id === profile?.id}
                          className="text-xs text-zinc-400 hover:text-orange-400 transition-colors disabled:opacity-40"
                        >
                          Edit
                        </button>
                        {u.id !== profile?.id && u.role !== 'system_admin' ? (
                          <button
                            onClick={() => handleImpersonate(u.id)}
                            disabled={impersonating === u.id}
                            className="text-xs text-zinc-400 hover:text-orange-400 transition-colors disabled:opacity-40"
                          >
                            {impersonating === u.id ? 'Loading…' : 'Impersonate'}
                          </button>
                        ) : (
                          u.id === profile?.id && <span className="text-xs text-zinc-600">You</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeEdit() }}
        >
          <div className="relative w-full max-w-md mx-4 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-foreground">Edit User</h2>
              <button
                onClick={closeEdit}
                className="text-zinc-500 hover:text-zinc-300 transition-colors text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Read-only info */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-800 bg-zinc-800/40 px-4 py-3 text-xs text-zinc-400">
                <div>
                  <span className="block text-zinc-500 mb-0.5">Has Household</span>
                  <span className={editUser.has_household ? 'text-green-400' : 'text-zinc-300'}>
                    {editUser.has_household ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-500 mb-0.5">Last Sign-in</span>
                  <span className="text-zinc-300">{relativeTime(editUser.last_sign_in_at)}</span>
                </div>
              </div>

              {/* First Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">First Name</label>
                <input
                  type="text"
                  value={editForm.first_name}
                  onChange={e => setEditForm(f => f ? { ...f, first_name: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Last Name</label>
                <input
                  type="text"
                  value={editForm.last_name}
                  onChange={e => setEditForm(f => f ? { ...f, last_name: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => f ? { ...f, email: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm(f => f ? { ...f, role: e.target.value as UserRole } : f)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Club */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Club</label>
                <select
                  value={editForm.club_id}
                  onChange={e => setEditForm(f => f ? { ...f, club_id: e.target.value } : f)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">No club</option>
                  {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              <button
                onClick={closeEdit}
                disabled={saving}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg text-sm font-medium shadow-lg border ${
          toast.ok
            ? 'bg-green-900/80 border-green-700 text-green-300'
            : 'bg-red-900/80 border-red-700 text-red-300'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
