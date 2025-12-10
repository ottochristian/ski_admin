'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useRequireAdmin } from '@/lib/auth-context'
import { useHouseholds } from '@/lib/hooks/use-households'
import { athletesService } from '@/lib/services/athletes-service'
import { useQueryClient } from '@tanstack/react-query'
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
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

export default function NewAthletePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { profile, loading: authLoading } = useRequireAdmin()

  // PHASE 2: RLS handles club filtering automatically
  const {
    data: households = [],
    isLoading: householdsLoading,
    error: householdsError,
  } = useHouseholds()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    householdId: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!profile?.club_id) {
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
      // Get household to ensure it belongs to the club (RLS will enforce this)
      const householdResult = await supabase
        .from('households')
        .select('id')
        .eq('id', formData.householdId)
        .single()

      if (householdResult.error || !householdResult.data) {
        setError('Household not found or access denied')
        setSaving(false)
        return
      }

      // Create athlete - RLS ensures club_id is set correctly
      const { error: insertError } = await supabase.from('athletes').insert({
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        household_id: formData.householdId,
        club_id: profile.club_id,
      })

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }

      // Invalidate athletes query
      queryClient.invalidateQueries({ queryKey: ['athletes'] })

      // Redirect to athletes list
      router.push('/admin/athletes')
    } catch (err) {
      console.error('Error creating athlete:', err)
      setError('Failed to create athlete')
      setSaving(false)
    }
  }

  const isLoading = authLoading || householdsLoading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading households…" />
  }

  // Show error state
  if (householdsError) {
    return <ErrorState error={householdsError} onRetry={() => router.refresh()} />
  }

  // Auth check ensures profile exists
  if (!profile) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Athlete</h1>
        <p className="text-muted-foreground">Create a new athlete profile</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Athlete Information</CardTitle>
          <CardDescription>Enter the athlete's details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) =>
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
                onChange={(e) =>
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
                onChange={(e) =>
                  setFormData({ ...formData, dateOfBirth: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <Input
                id="gender"
                value={formData.gender}
                onChange={(e) =>
                  setFormData({ ...formData, gender: e.target.value })
                }
                placeholder="e.g., M, F, Other"
              />
            </div>

            <div>
              <Label htmlFor="householdId">Household *</Label>
              <select
                id="householdId"
                value={formData.householdId}
                onChange={(e) =>
                  setFormData({ ...formData, householdId: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select a household</option>
                {households.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.primary_email || `Household ${h.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Athlete'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/athletes')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
