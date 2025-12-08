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
      // Verify user is linked to household via household_guardians
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Check if user is linked to household
      let { data: guardianCheck, error: guardianError } = await supabase
        .from('household_guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('household_id', household.id)
        .maybeSingle()

      // If no guardian link exists, try to create it
      if (!guardianCheck && !guardianError) {
        console.log('No household_guardians entry found, creating one...')
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
          console.error('Failed to create household_guardians entry:', createGuardianError)
          // Continue anyway - might work with families fallback
        } else {
          guardianCheck = { id: 'created' } // Mark as created
        }
      }

      // Check legacy families table as fallback
      let isHousehold = !!guardianCheck
      if (!guardianCheck) {
        const { data: familyCheck } = await supabase
          .from('families')
          .select('id')
          .eq('profile_id', user.id)
          .eq('id', household.id)
          .maybeSingle()

        if (!familyCheck) {
          setError('You are not linked to this household. Please contact support or run migration 21_fix_missing_households.sql')
          setLoading(false)
          return
        }
        isHousehold = false
      }

      // Check if using households or families
      const householdId = household.id

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

      // Get session token for API request
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Authentication failed. Please log in again.')
      }

      // Create athlete via API route (bypasses RLS but verifies ownership)
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      }

      const response = await fetch('/api/athletes/create', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          athlete: athleteData,
          clubId,
          householdId,
        }),
      })

      if (!response.ok) {
        let errorData: any = {}
        const responseText = await response.text()
        try {
          errorData = JSON.parse(responseText)
        } catch {
          errorData = { error: responseText || `HTTP ${response.status}: ${response.statusText}` }
        }
        
        console.error('Athlete creation failed:', {
          status: response.status,
          error: errorData,
        })
        
        throw new Error(errorData.error || `Failed to create athlete (${response.status})`)
      }

      const { athlete: athleteResult } = await response.json()

      // Success - redirect back to athletes page
      router.push(`/clubs/${clubSlug}/parent/athletes`)
      router.refresh()
    } catch (err) {
      console.error('Error creating athlete:', err)
      // Better error message extraction
      let errorMessage = 'Failed to create athlete'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (err && typeof err === 'object') {
        // Handle Supabase error objects
        const errorObj = err as any
        errorMessage = errorObj.message || errorObj.details || errorObj.hint || JSON.stringify(err)
      }
      setError(errorMessage)
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
