'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useParentClub } from '@/lib/use-parent-club'
import { clubQuery } from '@/lib/supabase-helpers'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function NewAthletePage() {
  const params = useParams()
  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const { clubId, household, loading: authLoading, error: authError } = useParentClub()

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
      // Check if using households or families
      const householdId = household.id
      const isHousehold = true // We'll try households first

      // Create athlete
      const athleteData: any = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        club_id: clubId,
      }

      // Use household_id if available, otherwise try family_id
      if (isHousehold) {
        athleteData.household_id = householdId
      } else {
        athleteData.family_id = householdId
      }

      const { error: athleteError } = await clubQuery(
        supabase.from('athletes').insert([athleteData]),
        clubId
      )

      if (athleteError) {
        // Try with family_id if household_id failed
        if (isHousehold) {
          const { error: familyError } = await clubQuery(
            supabase.from('athletes').insert([
              {
                ...athleteData,
                family_id: householdId,
                household_id: undefined,
              },
            ]),
            clubId
          )

          if (familyError) {
            throw familyError
          }
        } else {
          throw athleteError
        }
      }

      // Success - redirect back to athletes page
      router.push(`/clubs/${clubSlug}/parent/athletes`)
      router.refresh()
    } catch (err) {
      console.error('Error creating athlete:', err)
      setError(err instanceof Error ? err.message : 'Failed to create athlete')
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (authError || !household) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              {authError || 'No household found'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Athlete</h1>
        <p className="text-muted-foreground">
          Add a new athlete to your household
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Athlete Information</CardTitle>
          <CardDescription>
            Enter the athlete's basic information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Select
                value={formData.gender}
                onValueChange={value =>
                  setFormData({ ...formData, gender: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Add Athlete'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
