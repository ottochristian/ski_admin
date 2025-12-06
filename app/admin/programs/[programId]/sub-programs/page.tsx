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
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { Profile } from '@/lib/types'
import { useAdminClub } from '@/lib/use-admin-club'
import { clubQuery } from '@/lib/supabase-helpers'

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

  const { clubId, profile, loading: authLoading, error: authError } = useAdminClub()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

      if (authLoading || !clubId) {
        return
      }

      if (authError) {
        setError(authError)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      // Fetch parent program (for header) - verify it belongs to this club
      const { data: programData, error: programError } = await clubQuery(
        supabase
          .from('programs')
          .select('id, name')
          .eq('id', programId)
          .single(),
        clubId
      )

      if (programError || !programData) {
        setError(programError?.message ?? 'Program not found')
        setLoading(false)
        return
      }

      setProgram(programData as Program)

      // Load ACTIVE sub-programs for this program - filtered by club
      const { data, error: subProgramsError } = await clubQuery(
        supabase
          .from('sub_programs')
          .select('id, name, description, status')
          .eq('program_id', programId)
          .eq('status', ProgramStatus.ACTIVE)
          .order('name', { ascending: true }),
        clubId
      )

      if (subProgramsError) {
        setError(subProgramsError.message)
      } else {
        setSubPrograms((data || []) as SubProgram[])
      }

      setLoading(false)
    }

    load()
  }, [router, programId, clubId, authLoading, authError])

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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading sub-programs…</p>
      </div>
    )
  }

  if (error || authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error || authError}</CardDescription>
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
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
            <h1 className="text-3xl font-bold tracking-tight">
              {program.name} – Sub-programs
            </h1>
          </div>
          <p className="text-muted-foreground">
            Manage sub-programs for this program. Deleting a sub-program
            will also delete its groups (soft delete).
          </p>
        </div>
        <Link href={`/admin/programs/${programId}/sub-programs/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Sub-program
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Sub-programs</CardTitle>
          <CardDescription>
            All active sub-programs for this program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subPrograms.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active sub-programs yet. Click &quot;Add Sub-program&quot; to
              create one.
            </div>
          ) : (
            <div className="space-y-4">
              {subPrograms.map(sp => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
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
    </div>
  )
}
