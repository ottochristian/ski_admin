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

type Program = {
  id: string
  name: string
}

type SubProgram = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus
}

export default function SubProgramsPage() {
  const router = useRouter()
  const params = useParams() as { programId?: string }
  const rawProgramId = params.programId
  const programId =
    Array.isArray(rawProgramId) ? rawProgramId[0] : rawProgramId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [subPrograms, setSubPrograms] = useState<SubProgram[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // 🚧 Guard against bad URLs like /admin/programs/undefined/sub-programs
      if (!programId || programId === 'undefined') {
        console.error('Invalid programId in route:', programId)
        setLoading(false)
        router.push('/admin/programs')
        return
      }

      setLoading(true)
      setError(null)

      // 1) Ensure user is logged in
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setLoading(false)
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
        setLoading(false)
        router.push('/dashboard')
        return
      }

      setProfile(profileData as Profile)

      // 3) Fetch parent program (for header)
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, name')
        .eq('id', programId)
        .single()

      if (programError || !programData) {
        setError(programError?.message ?? 'Program not found')
        setLoading(false)
        return
      }

      setProgram(programData as Program)

      // 4) Load ACTIVE sub-programs for this program
      const { data, error: subProgramsError } = await supabase
        .from('sub_programs')
        .select('id, name, description, status')
        .eq('program_id', programId)
        .eq('status', ProgramStatus.ACTIVE)
        .order('name', { ascending: true })

      if (subProgramsError) {
        setError(subProgramsError.message)
      } else {
        setSubPrograms((data || []) as SubProgram[])
      }

      setLoading(false)
    }

    load()
  }, [router, programId])

  async function handleDelete(subProgramId: string) {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this sub-program? This will also delete all its groups. You cannot undo this from the UI.'
    )

    if (!confirmDelete) return

    setDeletingId(subProgramId)
    setError(null)

    const { error } = await supabase.rpc('soft_delete_sub_program', {
      sub_program_id: subProgramId,
    })

    if (error) {
      console.error('Error soft deleting sub-program:', error)
      setError(error.message)
    } else {
      setSubPrograms(prev => prev.filter(sp => sp.id !== subProgramId))
    }

    setDeletingId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground text-sm">Loading sub-programs…</p>
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

  if (!profile || !program) {
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
                  onClick={() => router.push('/admin/programs')}
                  aria-label="Back to programs"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold text-slate-900">
                  {program.name} – Sub-programs
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage sub-programs for this program. Deleting a sub-program
                will also delete its groups (soft delete).
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
              Sub-programs
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Active Sub-programs
          </h2>

          {/* Uses your nested "new" route */}
          <Link href={`/admin/programs/${programId}/sub-programs/new`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Sub-program
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            {subPrograms.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No active sub-programs yet. Click &quot;Add Sub-program&quot; to
                create one.
              </div>
            ) : (
              <div className="divide-y">
                {subPrograms.map(sp => (
                  <div
                    key={sp.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900">{sp.name}</h3>
                      {sp.description && (
                        <p className="text-sm text-muted-foreground">
                          {sp.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/programs/sub-programs/${sp.id}/edit`}
                      >
                        <Button variant="outline" size="sm">
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </Link>
                      <Link
                        href={`/admin/programs/sub-programs/${sp.id}/groups`}
                      >
                        <Button variant="outline" size="sm">
                          Groups
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(sp.id)}
                        disabled={deletingId === sp.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {deletingId === sp.id ? 'Deleting…' : 'Delete'}
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
