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
import { Settings } from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'
import { Profile } from '@/lib/types'

type SubProgram = {
  id: string
  name: string
  description?: string | null
  status: ProgramStatus | null
  program_id: string
}

type Program = {
  id: string
  name: string
}

export default function EditSubProgramPage() {
  const router = useRouter()
  const params = useParams() as { subProgramId?: string | string[] }

  const rawSubProgramId = params.subProgramId
  const subProgramId =
    Array.isArray(rawSubProgramId) ? rawSubProgramId[0] : rawSubProgramId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [subProgram, setSubProgram] = useState<SubProgram | null>(null)
  const [program, setProgram] = useState<Program | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function load() {
      // 🚧 Guard against bad URLs like /admin/programs/sub-programs/undefined/edit
      if (!subProgramId || subProgramId === 'undefined') {
        console.error(
          '[EditSubProgram] Invalid subProgramId in route, redirecting:',
          subProgramId
        )
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

      // 3) Fetch sub-program
      const { data: subProgramData, error: subProgramError } = await supabase
        .from('sub_programs')
        .select('id, name, description, status, program_id')
        .eq('id', subProgramId)
        .single()

      if (subProgramError || !subProgramData) {
        setError(subProgramError?.message ?? 'Sub-program not found')
        setLoading(false)
        return
      }

      const typedSubProgram = subProgramData as SubProgram
      setSubProgram(typedSubProgram)
      setName(typedSubProgram.name ?? '')
      setDescription(typedSubProgram.description ?? '')
      setIsActive(
        typedSubProgram.status === ProgramStatus.ACTIVE ||
          !typedSubProgram.status
      )

      // 4) Fetch parent program (for breadcrumb/navigation)
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, name')
        .eq('id', typedSubProgram.program_id)
        .single()

      if (programError || !programData) {
        setError(programError?.message ?? 'Parent program not found')
        setLoading(false)
        return
      }

      setProgram(programData as Program)
      setLoading(false)
    }

    load()
  }, [router, subProgramId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!subProgramId || subProgramId === 'undefined') {
      console.error('[EditSubProgram] handleSave with invalid subProgramId', subProgramId)
      return
    }

    setSaving(true)
    setError(null)

    const newStatus = isActive ? ProgramStatus.ACTIVE : ProgramStatus.INACTIVE

    const { error: updateError } = await supabase
      .from('sub_programs')
      .update({
        name,
        description,
        status: newStatus,
      })
      .eq('id', subProgramId)

    if (updateError) {
      console.error('[EditSubProgram] update error:', updateError)
      setError(updateError.message)
    } else {
      // Navigate back to the sub-programs list for this program
      if (subProgram?.program_id) {
        router.push(`/admin/programs/${subProgram.program_id}/sub-programs`)
      } else {
        router.push('/admin/programs')
      }
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground text-sm">Loading sub-program…</p>
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
            <Button
              variant="outline"
              onClick={() => router.push('/admin/programs')}
            >
              Back to Programs
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Edit Sub-program
              </h1>
              <p className="text-sm text-muted-foreground">
                Update the details for this sub-program.
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
            {program && (
              <Link href={`/admin/programs/${program.id}/sub-programs`}>
                <Button variant="ghost" size="sm">
                  {program.name}
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-6 py-8">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Sub-program Details</CardTitle>
            <CardDescription>
              A sub-program groups related content under a program
              (e.g., Beginner, Intermediate, Advanced under Alpine).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSave}>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
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
                  Sub-program is active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (subProgram?.program_id) {
                      router.push(
                        `/admin/programs/${subProgram.program_id}/sub-programs`
                      )
                    } else {
                      router.push('/admin/programs')
                    }
                  }}
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
      </main>
    </div>
  )
}
