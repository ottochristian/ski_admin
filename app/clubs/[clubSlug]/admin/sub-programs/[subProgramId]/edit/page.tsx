'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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

type Program = {
  id: string
  name: string
}

type SubProgram = {
  id: string
  name: string
  description?: string | null
  registration_fee?: number | null
  max_capacity?: number | null
  is_active?: boolean
  status?: string
  program_id: string
}

export default function EditSubProgramPage() {
  const router = useRouter()
  const params = useParams() as { clubSlug?: string; subProgramId?: string }
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const subProgramId = params.subProgramId as string | undefined

  const { profile, loading: authLoading } = useRequireAdmin()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [program, setProgram] = useState<Program | null>(null)
  const [subProgram, setSubProgram] = useState<SubProgram | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [registrationFee, setRegistrationFee] = useState<string>('0')
  const [maxCapacity, setMaxCapacity] = useState<string>('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function init() {
      if (!subProgramId) {
        setError('Missing sub-program id')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      // PHASE 2: RLS handles club filtering automatically
      const { data: spData, error: spError } = await supabase
        .from('sub_programs')
        .select(
          'id, name, description, registration_fee, max_capacity, is_active, status, program_id'
        )
        .eq('id', subProgramId)
        .single()

      if (spError || !spData) {
        setError(spError?.message || 'Sub-program not found')
        setLoading(false)
        return
      }

      const sp = spData as SubProgram
      setSubProgram(sp)

      // hydrate form fields
      setName(sp.name)
      setDescription(sp.description || '')
      setRegistrationFee(
        sp.registration_fee != null ? String(sp.registration_fee) : '0'
      )
      setMaxCapacity(
        sp.max_capacity != null ? String(sp.max_capacity) : ''
      )
      setIsActive(sp.is_active ?? (sp.status === 'ACTIVE'))

      // Load parent program for header
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, name')
        .eq('id', sp.program_id)
        .single()

      if (programError) {
        setError(programError.message)
        setLoading(false)
        return
      }

      setProgram(programData as Program)
      setLoading(false)
    }

    init()
  }, [subProgramId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!subProgramId) return

    setSaving(true)
    setError(null)

    const fee =
      registrationFee.trim() === '' ? null : Number(registrationFee.trim())
    const capacity =
      maxCapacity.trim() === '' ? null : Number(maxCapacity.trim())

    // PHASE 2: RLS ensures user can only update sub-programs in their club
    const { error: updateError } = await supabase
      .from('sub_programs')
      .update({
        name,
        description,
        registration_fee: fee,
        max_capacity: capacity,
        is_active: isActive,
        status: isActive ? 'ACTIVE' : 'INACTIVE',
      })
      .eq('id', subProgramId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push(`${basePath}/programs`)
  }

  if (authLoading || loading) {
    return <InlineLoading message="Loading sub-program…" />
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
            Edit Sub-Program
          </h1>
          <p className="text-muted-foreground">
            Program:{' '}
            <span className="font-medium">{program.name}</span> · Sub-program:{' '}
            <span className="font-medium">{subProgram.name}</span>
          </p>
        </div>
        <Link href={`${basePath}/programs`}>
          <Button variant="outline">Back to Programs</Button>
        </Link>
      </div>

      <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Sub-Program Details</CardTitle>
            <CardDescription>
              Update the details for this sub-program.
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
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Registration Fee
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={registrationFee}
                    onChange={e => setRegistrationFee(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={maxCapacity}
                    onChange={e => setMaxCapacity(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label htmlFor="isActive" className="text-sm text-slate-800">
                  Sub-program is active
                </label>
              </div>

              <div className="flex gap-3 justify-end">
                <Link href={`${basePath}/programs`}>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
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


