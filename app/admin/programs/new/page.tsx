'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAdminClub } from '@/lib/use-admin-club'
import { ProgramStatus } from '@/lib/programStatus'
import { withClubData, getCurrentSeason } from '@/lib/supabase-helpers'

export default function NewProgramPage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Wait for auth to complete
  useEffect(() => {
    if (authLoading) {
      return
    }

    if (authError) {
      setError(authError)
      setLoading(false)
      return
    }

    setLoading(false)
  }, [authLoading, authError])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    
    if (!clubId) {
      setError('No club associated with your account')
      return
    }

    setSaving(true)
    setError(null)

    // Get current season for this club
    const currentSeason = await getCurrentSeason(clubId)

    if (!currentSeason) {
      setError('No current season found. Please create a season first.')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase
      .from('programs')
      .insert([
        withClubData(
          {
            name,
            description,
            status: isActive ? ProgramStatus.ACTIVE : ProgramStatus.INACTIVE,
          },
          clubId,
          currentSeason.id
        ),
      ])

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    // Go back to programs list
    router.push('/admin/programs')
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Checking permissions…</p>
      </div>
    )
  }

  if (error || authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/programs">
              <Button>Back to Programs</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Program</h1>
          <p className="text-muted-foreground">
            Create a new program for your club (e.g., Alpine, Freeride, Nordic).
          </p>
        </div>
        <Link href="/admin/programs">
          <Button variant="outline">Back to Programs</Button>
        </Link>
      </div>

      <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Program Details</CardTitle>
            <CardDescription>
              This is the top-level program (e.g., Alpine, Freeride, Nordic, Snowboard).
              You can add sub-programs (Devo, Comp, etc.) later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">
                  Program Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Alpine, Freeride, Nordic, Snowboard..."
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
                  placeholder="Short description of this program..."
                />
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
                  Program is active
                </label>
              </div>

              {error && (
                <p className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="flex gap-3 justify-end">
                <Link href="/admin/programs">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Program'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </div>
  )
}
