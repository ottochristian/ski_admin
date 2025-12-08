'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAdminClub } from '@/lib/use-admin-club'
import { clubQuery, withClubData } from '@/lib/supabase-helpers'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function NewAthletePage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    householdId: '', // Admin can select household
  })
  const [households, setHouseholds] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (authLoading || !clubId) {
      return
    }

    if (authError) {
      setError(authError)
      setLoading(false)
      return
    }

    async function loadHouseholds() {
      try {
        const { data, error: householdsError } = await clubQuery(
          supabase
            .from('households')
            .select('id, primary_email')
            .order('primary_email'),
          clubId
        )

        if (householdsError) {
          console.error('Error loading households:', householdsError)
        } else {
          setHouseholds(
            (data || []).map((h: any) => ({
              id: h.id,
              name: h.primary_email || `Household ${h.id.slice(0, 8)}`,
            }))
          )
        }
      } catch (err) {
        console.error('Error loading households:', err)
      } finally {
        setLoading(false)
      }
    }

    loadHouseholds()
  }, [authLoading, authError, clubId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!clubId) {
      setError('Club ID is required')
      setSaving(false)
      return
    }

    if (!formData.householdId) {
      setError('Household is required')
      setSaving(false)
      return
    }

    try {
      const { error: insertError } = await clubQuery(
        supabase
          .from('athletes')
          .insert(
            withClubData(
              {
                household_id: formData.householdId,
                first_name: formData.firstName,
                last_name: formData.lastName,
                date_of_birth: formData.dateOfBirth || null,
                gender: formData.gender || null,
              },
              clubId
            )
          ),
        clubId
      )

      if (insertError) {
        throw insertError
      }

      router.push('/admin/athletes')
    } catch (err) {
      console.error('Error creating athlete:', err)
      setError(err instanceof Error ? err.message : 'Failed to create athlete')
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || authError}</p>
          <Button asChild variant="outline">
            <Link href="/admin/athletes">Back to Athletes</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Athlete</h1>
        <p className="text-muted-foreground">Add a new athlete to a household</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Athlete Information</CardTitle>
          <CardDescription>Enter the athlete's basic information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="householdId">Household *</Label>
              <select
                id="householdId"
                value={formData.householdId}
                onChange={e =>
                  setFormData({ ...formData, householdId: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select a household</option>
                {households.map(household => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={e =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={e =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={e =>
                  setFormData({ ...formData, dateOfBirth: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={formData.gender}
                onChange={e =>
                  setFormData({ ...formData, gender: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Athlete'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/athletes">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
