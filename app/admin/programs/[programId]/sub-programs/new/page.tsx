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

type Program = {
  id: string
  name: string
}

export default function NewSubProgramPage() {
  const router = useRouter()
  const params = useParams() as { programId?: string | string[] }

  const rawProgramId = params.programId
  const programId =
    Array.isArray(rawProgramId) ? rawProgramId[0] : rawProgramId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [program, setProgram] = useState<Program | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

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

      // 3) Fetch parent program (for header)
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('id, name')
        .eq('id', programId)
        .single()

      if (programError || !programData) {
        setError(programError?.message ?? 'Program not found')
        setLoading(false)
        return
      }

      setProgram(programData as Program)
      setLoading(false)
    }

    load()
  }, [router, programId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!programId || programId === 'undefined') {
      console.error(
        '[NewSubProgram] handleSave with invalid programId',
        programId
      )
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('sub_programs')
        .insert({
          program_id: programId,
          name,
          description,
          status: ProgramStatus.ACTIVE,
        })

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-muted-foreground text-sm">Loading sub-program form…</p>
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Add Sub-program
              </h1>
              <p className="text-sm text-slate-900">
                Parent program: {program.name}
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
            <Link href={`/admin/programs/${program.id}/sub-programs`}>
              <Button variant="ghost" size="sm">
                Sub-programs
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-6 py-8">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>New Sub-program</CardTitle>
            <CardDescription className="text-slate-700">
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
      </main>
    </div>
  )
}
