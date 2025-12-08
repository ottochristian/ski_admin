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
import { clubQuery, withClubData } from '@/lib/supabase-helpers'

type Program = {
  id: string
  name: string
}

export default function NewSubProgramPage() {
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
  const [registrationFee, setRegistrationFee] = useState<string>('0')
  const [maxCapacity, setMaxCapacity] = useState<string>('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function load() {
      // 🚧 Guard against bad URLs like /admin/programs/undefined/sub-programs/new
      if (!programId || programId === 'undefined') {
        console.error(
          '[NewSubProgram] Invalid programId in route, redirecting:',
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
      setLoading(false)
    }

    load()
  }, [router, programId, clubId, authLoading, authError])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!programId || programId === 'undefined' || !clubId) {
      console.error(
        '[NewSubProgram] handleSave with invalid programId or clubId',
        { programId, clubId }
      )
      return
    }

    setSaving(true)
    setError(null)

    try {
      const fee =
        registrationFee.trim() === '' ? null : Number(registrationFee.trim())
      const capacity =
        maxCapacity.trim() === '' ? null : Number(maxCapacity.trim())

      const { data: inserted, error: insertError } = await supabase
        .from('sub_programs')
        .insert(
          withClubData(
            {
              program_id: programId,
              name,
              description,
              registration_fee: fee,
              max_capacity: capacity,
              is_active: isActive,
              status: ProgramStatus.ACTIVE,
            },
            clubId
          )
        )

      if (insertError) {
        console.error('[NewSubProgram] insert error:', insertError, { inserted })
        setError(insertError.message ?? JSON.stringify(insertError))
      } else {
        router.push(`/admin/programs/${programId}/sub-programs`)
      }
    } catch (err) {
      console.error('[NewSubProgram] unexpected error:', err)
      setError(String(err))
    }

    setSaving(false)
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading sub-program form…</p>
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
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  programId && programId !== 'undefined'
                    ? `/admin/programs/${programId}/sub-programs`
                    : '/admin/programs'
                )
              }
            >
              Back
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
        <h1 className="text-3xl font-bold tracking-tight">Add Sub-program</h1>
        <p className="text-muted-foreground">
          Parent program: {program.name}
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>New Sub-program</CardTitle>
          <CardDescription>
            Create a new sub-program under {program.name}.
          </CardDescription>
        </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSave}>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900">
                  Sub-program Name
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
                <label className="block text-sm font-medium text-slate-900">
                  Description
                </label>
                <textarea
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-900">
                    Registration Fee
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    value={registrationFee}
                    onChange={e => setRegistrationFee(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-900">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    value={maxCapacity}
                    onChange={e => setMaxCapacity(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-slate-900">
                  Sub-program is active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    router.push(
                      `/admin/programs/${program.id}/sub-programs`
                    )
                  }
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Create Sub-program'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </div>
  )
}
