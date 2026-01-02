'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useParentClub } from '@/lib/use-parent-club'
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
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

export default function NewAthletePage() {
  const params = useParams()
  const [supabase] = useState(() => createClient())

  const router = useRouter()
  const queryClient = useQueryClient()
  const clubSlug = params.clubSlug as string
  const { clubId, household, loading: authLoading, error: authError } =
    useParentClub()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!clubId || !household) {
      setError('Missing household information')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Verify user is linked to household via household_guardians
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // PHASE 2: RLS ensures user can only create athletes in their household
      // Check if user is linked to household (RLS will enforce this)
      const { data: guardianCheck, error: guardianError } = await supabase
        .from('household_guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('household_id', household.id)
        .maybeSingle()

      // If no guardian link exists, try to create it
      if (!guardianCheck && !guardianError) {
        console.log(
          'No household_guardians entry found, creating one...'
        )
        const { error: createGuardianError } = await supabase
          .from('household_guardians')
          .insert([
            {
              household_id: household.id,
              user_id: user.id,
              is_primary: true,
            },
          ])

        if (createGuardianError) {
          console.error(
            'Failed to create household_guardians entry:',
            createGuardianError
          )
          // Continue anyway - might work with families fallback
        }
      }

      // Check legacy families table as fallback
      if (!guardianCheck) {
        const { data: familyCheck } = await supabase
          .from('families')
          .select('id')
          .eq('profile_id', user.id)
          .eq('id', household.id)
          .maybeSingle()

        if (!familyCheck) {
          setError(
            'You are not linked to this household. Please contact support.'
          )
          setLoading(false)
          return
        }
      }

      // Create athlete - RLS ensures club_id and household_id are correct
      const { error: insertError } = await supabase.from('athletes').insert({
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        household_id: household.id,
        club_id: clubId,
      })

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      // Force refetch to ensure cache is updated before redirect
      // Invalidate athletes cache to show new athlete immediately
      await queryClient.invalidateQueries({ queryKey: ['athletes'] })
      if (formData.householdId) {
        await queryClient.invalidateQueries({ queryKey: ['athletes', 'household', formData.householdId] })
      }
      router.push(`/clubs/${clubSlug}/parent/athletes`)
    } catch (err) {
      console.error('Error creating athlete:', err)
      setError('Failed to create athlete')
      setLoading(false)
    }
  }

  // Show loading state
  if (authLoading) {
    return <InlineLoading message="Loading…" />
  }

  // Show error state
  if (authError) {
    return <ErrorState error={authError} onRetry={() => router.refresh()} />
  }

  // Show message if no household
  if (!household) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>
              Please set up your household before adding athletes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Athlete</h1>
        <p className="text-muted-foreground">
          Add a new athlete to your household
        </p>
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

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Athlete'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/clubs/${clubSlug}/parent/athletes`)}
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
