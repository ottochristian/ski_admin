'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { ProgramStatus } from '@/lib/programStatus'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Profile } from '@/lib/types'
import { useAdminClub } from '@/lib/use-admin-club'
import { clubQuery } from '@/lib/supabase-helpers'

type Program = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus | null
}

export default function ProgramsPage() {
  const router = useRouter()
  const { clubId, profile, loading: authLoading, error: authError } = useAdminClub()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
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

      // Load programs filtered by club
      const { data, error: programsError } = await clubQuery(
        supabase
          .from('programs')
          .select('id, name, description, status, club_id')
          .order('name', { ascending: true }),
        clubId
      )

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

  if (!profile) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground">
            Manage all ski programs, including soft-deleting them.
          </p>
        </div>
        <Link href="/admin/programs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Program
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Programs</CardTitle>
          <CardDescription>
            All active ski programs in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active programs yet. Click &quot;Add Program&quot; to create
              one.
            </div>
          ) : (
            <div className="space-y-4">
              {programs.map(program => (
                <div
                  key={program.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
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
    </div>
  )
}
