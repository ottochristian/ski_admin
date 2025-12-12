"use client"

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
import { useRequireAdmin } from '@/lib/auth-context'
import { InlineLoading } from '@/components/ui/loading-states'

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
  const params = useParams() as { clubSlug?: string; subProgramId?: string }
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const subProgramId = params.subProgramId as string

  const { profile, loading: authLoading } = useRequireAdmin()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [program, setProgram] = useState<SimpleProgram | null>(null)
  const [subProgram, setSubProgram] = useState<SimpleSubProgram | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (authLoading || !profile) {
        return
      }

      setLoading(true)
      setError(null)

      // PHASE 2: RLS handles club filtering automatically
      // Load the sub-program (with program_id)
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

      // Load the parent program using program_id
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

      // Load ACTIVE groups for this sub-program
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

    if (subProgramId && !authLoading) {
      load()
    }
  }, [router, subProgramId, authLoading, profile])

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

  if (authLoading || loading) {
    return <InlineLoading message="Loading groups…" />
  }

  if (error && !subProgram) {
    return (
      <div className="flex items-center justify-center py-12">
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`${basePath}/programs`)}
              aria-label="Back to programs"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              {program.name} – {subProgram.name} – Groups
            </h1>
          </div>
          <p className="text-muted-foreground">
            Manage athlete groups for this sub-program.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Groups</CardTitle>
          <CardDescription>
            All active groups for this sub-program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active groups yet.
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map(group => (
                <div key={group.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div>
                    <h3 className="font-medium text-slate-900">{group.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(group.id)} disabled={deletingId === group.id}>
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
    </div>
  )
}

