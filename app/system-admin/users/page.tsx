'use client'

import { useEffect, useState } from 'react'
import { useSystemAdmin } from '@/lib/use-system-admin'
import { createClient } from '@/lib/supabase/client'

type UserRole = 'parent' | 'coach' | 'admin' | 'system_admin'

type UserRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  club_id: string | null
  club_name: string | null
  created_at: string
}

const ROLES: UserRole[] = ['parent', 'coach', 'admin', 'system_admin']

const roleBadge: Record<UserRole, string> = {
  parent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  coach: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  admin: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  system_admin: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function UsersPage() {
  const { profile, loading: authLoading } = useSystemAdmin()
  const [supabase] = useState(() => createClient())

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, club_id, created_at, clubs(name)')
      .order('created_at', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    setUsers(
      (data || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        club_id: u.club_id,
        club_name: u.clubs?.name ?? null,
        created_at: u.created_at,
      }))
    )
    setLoading(false)
  }

  useEffect(() => {
    if (!authLoading) loadUsers()
  }, [authLoading])

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdating(userId)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch(`/api/system-admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ role: newRole }),
    })
    const json = await resp.json()
    setUpdating(null)
    if (resp.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      showToast('Role updated successfully', true)
    } else {
      showToast(json.error || 'Failed to update role', false)
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
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q)
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
                <th className="px-5 py-3 text-left">Joined</th>
                <th className="px-5 py-3 text-left">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500">No users found</td></tr>
              ) : filtered.map(u => (
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
                  <td className="px-5 py-3 text-zinc-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      disabled={updating === u.id || u.id === profile?.id}
                      onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-40"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {updating === u.id && <span className="ml-2 text-xs text-zinc-500">Saving…</span>}
                    {u.id === profile?.id && <span className="ml-2 text-xs text-zinc-600">You</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
