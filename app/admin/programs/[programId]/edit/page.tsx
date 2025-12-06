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
import { Profile } from '@/lib/types'
import { useAdminClub } from '@/lib/use-admin-club'
import { clubQuery } from '@/lib/supabase-helpers'

type Program = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus | null
}

export default function EditProgramPage() {
  const router = useRouter()
  const params = useParams() as { programId?: string | string[] }
  const { clubId, profile, loading: authLoading, error: authError } = useAdminClub()

  const rawProgramId = params.programId
  const programId =
    Array.isArray(rawProgramId) ? rawProgramId[0] : rawProgramId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [program, setProgram] = useState<Program | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function load() {
      // 🚧 Guard against bad URLs like /admin/programs/undefined/edit
      if (!programId || programId === 'undefined') {
        console.error(
          '[EditProgram] Invalid programId in route, redirecting:',
          programId
        )
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

      // Fetch program - verify it belongs to this club
      const { data: programData, error: programError } = await clubQuery(
        supabase
          .from('programs')
          .select('id, name, description, status')
          .eq('id', programId)
          .single(),
        clubId
      )

      if (programError || !programData) {
        setError(programError?.message ?? 'Program not found')
        setLoading(false)
        return
      }

      const typedProgram = programData as Program
      setProgram(typedProgram)
      setName(typedProgram.name ?? '')
      setDescription(typedProgram.description ?? '')
      setIsActive(
        typedProgram.status === ProgramStatus.ACTIVE || !typedProgram.status
      )

      setLoading(false)
    }

    load()
  }, [router, programId, clubId, authLoading, authError])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!programId || programId === 'undefined' || !clubId) {
      console.error('[EditProgram] handleSave with invalid programId or clubId', { programId, clubId })
      return
    }

    setSaving(true)
    setError(null)

    const newStatus = isActive ? ProgramStatus.ACTIVE : ProgramStatus.INACTIVE

    // Update with club filter to ensure we can only update our club's programs
    const { error: updateError } = await clubQuery(
      supabase
        .from('programs')
        .update({
          name,
          description,
          status: newStatus,
        })
        .eq('id', programId),
      clubId
    )

    if (updateError) {
      console.error('[EditProgram] update error:', updateError)
      setError(updateError.message)
    } else {
      router.push('/admin/programs')
    }

    setSaving(false)
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading program…</p>
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
            <Button variant="outline" onClick={() => router.push('/admin/programs')}>
              Back to Programs
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Program</h1>
        <p className="text-muted-foreground">
          Update the details for this program.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Program Details</CardTitle>
          <CardDescription>
            This is the top-level program (e.g., Alpine, Freeride, Nordic).
          </CardDescription>
        </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSave}>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Program Name
                </label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is-active"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                />
                <label
                  htmlFor="is-active"
                  className="text-sm font-medium text-slate-700"
                >
                  Program is active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/programs')}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </div>
  )
}
