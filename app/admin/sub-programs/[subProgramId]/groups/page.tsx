'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { ProgramStatus } from '@/lib/programStatus'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'
import { Profile } from '@/lib/types'

type SimpleProgram = {
  id: string
  name: string
}

type SimpleSubProgram = {
  id: string
  name: string
  program_id: string
}

type Group = {
  id: string
  name: string
  status: ProgramStatus
}

export default function GroupsPage() {
  const router = useRouter()
  const params = useParams()
  const subProgramId = params.subProgramId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [program, setProgram] = useState<SimpleProgram | null>(null)
  const [subProgram, setSubProgram] = useState<SimpleSubProgram | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // 1) Ensure user is logged in
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      // 2) Fetch profile and ensure admin
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      if (!profileData || profileData.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setProfile(profileData as Profile)

      // 3) Load the sub-program (with program_id)
      const { data: subProgramData, error: subProgramError } = await supabase
        .from('sub_programs')
        .select('id, name, program_id')
        .eq('id', subProgramId)
        .single()

      if (subProgramError || !subProgramData) {
        setError(subProgramError?.message ?? 'Sub-program not found')
        setLoading(false)
        return
      }

      const subProg = subProgramData as SimpleSubProgram
      setSubProgram(subProg)

      // 4) Load the parent program using program_id
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, name')
        .eq('id', subProg.program_id)
        .single()

      if (programError || !programData) {
        setError(programError?.message ?? 'Parent program not found')
        setLoading(false)
        return
      }

      setProgram(programData as SimpleProgram)

      // 5) Load ACTIVE groups for this sub-program
      const { data, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, status')
        .eq('sub_program_id', subProgramId)
        .eq('status', ProgramStatus.ACTIVE)
        .order('name', { ascending: true })

      if (groupsError) {
        setError(groupsError.message)
      } else {
        setGroups((data || []) as Group[])
      }

      setLoading(false)
    }

    if (subProgramId) {
      load()
    }
  }, [router, subProgramId])

  async function handleDelete(groupId: string) {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this group? You cannot undo this from the UI.'
    )

    if (!confirmDelete) return

    setDeletingId(groupId)
    setError(null)

    const { error } = await supabase.rpc('soft_delete_group', {
      group_id: groupId,
    })

    if (error) {
      console.error('Error soft deleting group:', error)
      setError(error.message)
    } else {
      setGroups(prev => prev.filter(g => g.id !== groupId))
    }

    setDeletingId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground text-sm">Loading groups…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.refresh()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile || !subProgram || !program) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    router.push(`/admin/programs/${program.id}/sub-programs`)
                  }
                  aria-label="Back to sub-programs"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold text-slate-900">
                  {program.name} – {subProgram.name} – Groups
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage athlete groups for this sub-program.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/settings">
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <LogoutButton />
            </div>
          </div>

          {/* Quick Nav */}
          <nav className="flex gap-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link href="/admin/programs">
              <Button variant="ghost" size="sm">
                Programs
              </Button>
            </Link>
            <Button variant="ghost" size="sm" disabled>
              Groups
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Active Groups
          </h2>
          <Link href={`/admin/sub-programs/${subProgramId}/groups/new`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Group
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            {groups.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No active groups yet. Click &quot;Add Group&quot; to create one.
              </div>
            ) : (
              <div className="divide-y">
                {groups.map(group => (
                  <div
                    key={group.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900">
                        {group.name}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/sub-programs/${subProgramId}/groups/${group.id}/edit`}
                      >
                        <Button variant="outline" size="sm">
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(group.id)}
                        disabled={deletingId === group.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {deletingId === group.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
