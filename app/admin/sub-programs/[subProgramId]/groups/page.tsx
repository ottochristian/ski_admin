'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import Link from 'next/link'

type Program = {
  id: string
  name: string
}

type SubProgram = {
  id: string
  name: string
  program_id: string
}

type Group = {
  id: string
  name: string
}

export default function SubProgramGroupsPage() {
  const router = useRouter()
  const params = useParams()
  const subProgramId = params.subProgramId as string | undefined

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [program, setProgram] = useState<Program | null>(null)
  const [subProgram, setSubProgram] = useState<SubProgram | null>(null)
  const [groups, setGroups] = useState<Group[]>([])

  const [newGroupName, setNewGroupName] = useState('')

  useEffect(() => {
    async function init() {
      if (!subProgramId) {
        setError('Missing sub-program id')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      // 1) auth
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      // 2) profile / admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      // 3) load sub-program
      const { data: spData, error: spError } = await supabase
        .from('sub_programs')
        .select('id, name, program_id')
        .eq('id', subProgramId)
        .single()

      if (spError || !spData) {
        setError(spError?.message || 'Sub-program not found')
        setLoading(false)
        return
      }

      const sp = spData as SubProgram
      setSubProgram(sp)

      // 4) load parent program
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, name')
        .eq('id', sp.program_id)
        .single()

      if (programError || !programData) {
        setError(programError?.message || 'Program not found')
        setLoading(false)
        return
      }

      setProgram(programData as Program)

      // 5) load groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('sub_program_id', subProgramId)
        .order('name', { ascending: true })

      if (groupsError) {
        setError(groupsError.message)
      } else {
        setGroups((groupsData || []) as Group[])
      }

      setLoading(false)
    }

    init()
  }, [router, subProgramId])

  async function handleAddGroup(e: FormEvent) {
    e.preventDefault()
    if (!newGroupName.trim() || !subProgramId) return

    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('groups')
      .insert([
        {
          name: newGroupName.trim(),
          sub_program_id: subProgramId,
        },
      ])
      .select('id, name')
      .single()

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    if (data) {
      setGroups(prev => [...prev, data as Group])
      setNewGroupName('')
    }
  }

  async function handleDeleteGroup(groupId: string) {
    const confirmed = window.confirm('Delete this group? This cannot be undone.')
    if (!confirmed) return

    setDeletingId(groupId)
    setError(null)

    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)

    setDeletingId(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setGroups(prev => prev.filter(g => g.id !== groupId))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading groups…</p>
      </div>
    )
  }

  if (error && (!subProgram || !program)) {
    // Fatal error state
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/programs">
              <Button>Back to Programs</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!subProgram || !program) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Manage Groups
            </h1>
            <p className="text-sm text-slate-600">
              Program:{' '}
              <span className="font-medium">{program.name}</span> · Sub-program:{' '}
              <span className="font-medium">{subProgram.name}</span>
            </p>
          </div>
          <Link href="/admin/programs">
            <Button variant="outline">Back to Programs</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {error && (
          <p className="text-sm text-red-600 mb-2">Error: {error}</p>
        )}

        {/* Existing groups */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Groups</CardTitle>
            <CardDescription>
              These groups are used to organize athletes within this sub-program.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length > 0 ? (
              <div className="flex flex-col gap-2">
                {groups.map(group => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between border rounded-md px-3 py-2 bg-white"
                  >
                    <span className="text-sm">{group.name}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDeleteGroup(group.id)}
                      disabled={deletingId === group.id}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                No groups yet. Add your first group below.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Add new group */}
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Add New Group</CardTitle>
            <CardDescription>
              For example: &quot;U10 Girls&quot;, &quot;U12 Boys&quot;, &quot;High School&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. U10 Girls, U12 Comp, HS Varsity..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Adding…' : 'Add Group'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
