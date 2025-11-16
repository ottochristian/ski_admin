'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Group = {
  id: string
  name: string
}

type SubProgram = {
  id: string
  name: string
  description?: string | null
  is_active?: boolean
  registration_fee?: number | null
  max_capacity?: number | null
  groups?: Group[]
}

type Program = {
  id: string
  name: string
  description?: string | null
  is_active?: boolean
  sub_programs?: SubProgram[]
}

export default function AdminProgramsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

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

      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select(
          `
          id,
          name,
          description,
          is_active,
          sub_programs (
            id,
            name,
            description,
            is_active,
            registration_fee,
            max_capacity,
            groups (
              id,
              name
            )
          )
        `
        )
        .order('name', { ascending: true })

      if (programsError) {
        setError(programsError.message)
      } else {
        setPrograms((programsData || []) as Program[])
      }

      setLoading(false)
    }

    load()
  }, [router])

  // Delete a whole program (and its sub-programs/groups if FK/RLS allows)
  async function handleDeleteProgram(programId: string) {
    const confirmed = window.confirm(
      'Delete this program and all its sub-programs/groups? This cannot be undone.'
    )
    if (!confirmed) return

    setDeletingId(programId)
    setError(null)

    // NOTE: for real safety you may want ON DELETE CASCADE on FKs,
    // or explicit deletes of sub_programs/groups/registrations.
    const { error: deleteError } = await supabase
      .from('programs')
      .delete()
      .eq('id', programId)

    setDeletingId(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setPrograms(prev => prev.filter(p => p.id !== programId))
  }

  // Delete a single sub-program
  async function handleDeleteSubProgram(subProgramId: string) {
    const confirmed = window.confirm(
      'Delete this sub-program (and its groups/registrations if any)?'
    )
    if (!confirmed) return

    setDeletingId(subProgramId)
    setError(null)

    const { error: deleteError } = await supabase
      .from('sub_programs')
      .delete()
      .eq('id', subProgramId)

    setDeletingId(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setPrograms(prev =>
      prev.map(program => ({
        ...program,
        sub_programs: program.sub_programs?.filter(
          sp => sp.id !== subProgramId
        ),
      }))
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 text-sm">Loading programs…</p>
      </div>
    )
  }

  if (error) {
    // non-fatal error display; still show whatever we have
    console.error(error)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Programs Management
              </h1>
              <p className="text-slate-600">
                Manage programs, sub-programs, and groups
              </p>
            </div>
            <Link href="/admin/programs/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Program
              </Button>
            </Link>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">
              Error: {error}
            </p>
          )}
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-6">
          {programs.map(program => (
            <Card key={program.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">
                        {program.name}
                      </CardTitle>
                      <Badge
                        variant={program.is_active ? 'default' : 'secondary'}
                      >
                        {program.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription>{program.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/programs/${program.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteProgram(program.id)}
                      disabled={deletingId === program.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingId === program.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      Sub-Programs
                    </h3>
                    <Link
                      href={`/admin/programs/${program.id}/sub-programs/new`}
                    >
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Sub-Program
                      </Button>
                    </Link>
                  </div>

                  {program.sub_programs && program.sub_programs.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {program.sub_programs.map(subProgram => (
                        <Card
                          key={subProgram.id}
                          className="border-slate-200"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <CardTitle className="text-base">
                                  {subProgram.name}
                                </CardTitle>
                                <CardDescription className="text-sm mt-1">
                                  {subProgram.description}
                                </CardDescription>
                              </div>
                              <Badge
                                variant={
                                  subProgram.is_active ? 'default' : 'secondary'
                                }
                                className="text-xs"
                              >
                                {subProgram.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600">Fee:</span>
                              <span className="font-semibold">
                                $
                                {subProgram.registration_fee != null
                                  ? subProgram.registration_fee
                                  : 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">
                                Capacity:
                              </span>
                              <span className="text-slate-900">
                                {subProgram.max_capacity ?? '-'}
                              </span>
                            </div>

                            {subProgram.groups &&
                              subProgram.groups.length > 0 && (
                                <div className="pt-2 border-t">
                                  <p className="text-slate-600 mb-1">
                                    Groups ({subProgram.groups.length}):
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {subProgram.groups.map(group => (
                                      <Badge
                                        key={group.id}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {group.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                            <div className="flex gap-2 pt-2">
                              <Link
                                href={`/admin/sub-programs/${subProgram.id}/edit`}
                                className="flex-1"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                >
                                  Edit
                                </Button>
                              </Link>
                              <Link
                                href={`/admin/sub-programs/${subProgram.id}/groups`}
                                className="flex-1"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                >
                                  Groups
                                </Button>
                              </Link>
                            </div>

                            <div className="flex justify-end pt-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleDeleteSubProgram(subProgram.id)
                                }
                                disabled={deletingId === subProgram.id}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {deletingId === subProgram.id
                                  ? 'Deleting…'
                                  : 'Delete'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 py-4">
                      No sub-programs yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {programs.length === 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>No Programs Yet</CardTitle>
              <CardDescription>
                Get started by creating your first program
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/programs/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Program
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
