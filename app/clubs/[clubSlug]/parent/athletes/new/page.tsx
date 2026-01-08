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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'
import { toast } from 'sonner'

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

      // Use SECURITY DEFINER function to create athlete (bypasses RLS issues)
      const { data: athleteId, error: createError } = await supabase
        .rpc('create_athlete_for_parent', {
          p_user_id: user.id as any, // Cast to UUID for PostgreSQL function
          p_first_name: formData.firstName,
          p_last_name: formData.lastName,
          p_household_id: household.id,
          p_club_id: clubId,
          p_date_of_birth: formData.dateOfBirth || null,
          p_gender: formData.gender || null,
        })

      if (createError) {
        console.error('Athlete creation error:', createError)
        setError(createError.message)
        setLoading(false)
        return
      }

      // Athlete created successfully - redirect to athletes list
      // Waivers will be handled during program registration (cart/checkout)
      await queryClient.invalidateQueries({ queryKey: ['athletes'] })
      router.push(`/clubs/${clubSlug}/parent/athletes`)
      toast.success(`${formData.firstName} ${formData.lastName} has been added to your household!`)
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
              <Label htmlFor="gender">Gender <span className="text-muted-foreground">(Optional)</span></Label>
              <Select
                value={formData.gender || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, gender: value })
                }
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
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
