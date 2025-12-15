'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
import Link from 'next/link'
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

export default function NewGroupPage() {
  const router = useRouter()
  const params = useParams() as { clubSlug?: string; subProgramId?: string }
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const subProgramId = params.subProgramId as string

  const { profile, loading: authLoading } = useRequireAdmin()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [program, setProgram] = useState<SimpleProgram | null>(null)
  const [subProgram, setSubProgram] = useState<SimpleSubProgram | null>(null)

  const [name, setName] = useState('')

  useEffect(() => {
    async function init() {
      if (!subProgramId) {
        setError('Missing sub-program id')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      // Load the sub-program
      const { data: subProgramData, error: subProgramError } = await supabase
        .from('sub_programs')
        .select('id, name, program_id')
        .eq('id', subProgramId)
        .single()

      if (subProgramError || !subProgramData) {
        setError(subProgramError?.message || 'Sub-program not found')
        setLoading(false)
        return
      }

      const subProg = subProgramData as SimpleSubProgram
      setSubProgram(subProg)

      // Load the parent program
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, name')
        .eq('id', subProg.program_id)
        .single()

      if (programError) {
        setError(programError.message)
        setLoading(false)
        return
      }

      setProgram(programData as SimpleProgram)
      setLoading(false)
    }

    init()
  }, [subProgramId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!subProgramId || !profile) return

    setSaving(true)
    setError(null)

    // PHASE 2: RLS ensures user can only create groups in their club
    const { error: insertError } = await supabase
      .from('groups')
      .insert({
        name,
        sub_program_id: subProgramId,
        club_id: profile.club_id,
        status: ProgramStatus.ACTIVE, // New groups are active by default
      })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    // Navigate back to groups list
    router.push(`${basePath}/sub-programs/${subProgramId}/groups`)
  }

  if (authLoading || loading) {
    return <InlineLoading message="Loading…" />
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
            <Link href={`${basePath}/programs`}>
              <Button>Back to Programs</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!subProgram || !program || !profile) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Add New Group
          </h1>
          <p className="text-muted-foreground">
            Program:{' '}
            <span className="font-medium">{program.name}</span> · Sub-program:{' '}
            <span className="font-medium">{subProgram.name}</span>
          </p>
        </div>
        <Link href={`${basePath}/sub-programs/${subProgramId}/groups`}>
          <Button variant="outline">Back to Groups</Button>
        </Link>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Group Details</CardTitle>
          <CardDescription>
            Create a new athlete group for this sub-program.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                Group Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Group A, Morning Group, Beginners..."
              />
              <p className="text-xs text-slate-600 mt-1">
                Groups help organize athletes within a sub-program.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Link href={`${basePath}/sub-programs/${subProgramId}/groups`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create Group'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
