'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Settings, Plus, Pencil, Trash2 } from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'
import { Profile } from '@/lib/types'

type Program = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus | null
}

export default function ProgramsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
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

      // 3) Load programs (no programId involved here)
      const { data, error: programsError } = await supabase
        .from('programs')
        .select('id, name, description, status')
        .order('name', { ascending: true })

      if (programsError) {
        setError(programsError.message)
      } else {
        const allPrograms = (data || []) as Program[]
        // Only show ACTIVE programs (or rows with null status from before we added the enum)
        const activePrograms = allPrograms.filter(
          p => p.status === ProgramStatus.ACTIVE || p.status === null
        )
        setPrograms(activePrograms)
      }

      setLoading(false)
    }

    load()
  }, [router])

  async function handleDelete(programId: string) {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this program? This will also soft-delete all its sub-programs and groups.'
    )

    if (!confirmDelete) return

    setDeletingId(programId)
    setError(null)

    const { error } = await supabase.rpc('soft_delete_program', {
      program_id: programId,
    })

    if (error) {
      console.error('Error soft deleting program:', error)
      setError(error.message)
    } else {
      // Remove from local state so the UI updates immediately
      setPrograms(prev => prev.filter(p => p.id !== programId))
    }

    setDeletingId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground text-sm">Loading programs…</p>
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

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Programs</h1>
              <p className="text-sm text-muted-foreground">
                Manage all ski programs, including soft-deleting them.
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
            <Link href="/admin/registrations">
              <Button variant="ghost" size="sm">
                Registrations
              </Button>
            </Link>
            <Link href="/admin/athletes">
              <Button variant="ghost" size="sm">
                Athletes
              </Button>
            </Link>
            <Link href="/admin/coaches">
              <Button variant="ghost" size="sm">
                Coaches
              </Button>
            </Link>
            <Link href="/admin/races">
              <Button variant="ghost" size="sm">
                Races
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Active Programs
          </h2>
          <Link href="/admin/programs/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Program
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            {programs.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No active programs yet. Click &quot;Add Program&quot; to create
                one.
              </div>
            ) : (
              <div className="divide-y">
                {programs.map(program => (
                  <div
                    key={program.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900">
                        {program.name}
                      </h3>
                      {program.description && (
                        <p className="text-sm text-muted-foreground">
                          {program.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {/* Go to sub-programs for this program */}
                      <Link
                        href={`/admin/programs/${program.id}/sub-programs`}
                      >
                        <Button variant="outline" size="sm">
                          Sub-programs
                        </Button>
                      </Link>
                      <Link href={`/admin/programs/${program.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(program.id)}
                        disabled={deletingId === program.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {deletingId === program.id ? 'Deleting…' : 'Delete'}
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
