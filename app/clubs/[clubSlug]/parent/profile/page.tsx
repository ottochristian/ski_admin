'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useParentClub } from '@/lib/use-parent-club'
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
import { ImageUpload } from '@/components/image-upload'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft } from 'lucide-react'

interface ProfileData {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

interface HouseholdData {
  id: string
  phone?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
}

export default function ParentProfilePage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, household } = useParentClub()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    avatarUrl: '',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: profile.email || '',
        phone: household?.phone || '',
        addressLine1: household?.address_line1 || '',
        addressLine2: household?.address_line2 || '',
        city: household?.city || '',
        state: household?.state || '',
        zipCode: household?.zip_code || '',
        emergencyContactName: household?.emergency_contact_name || '',
        emergencyContactPhone: household?.emergency_contact_phone || '',
        avatarUrl: profile.avatar_url || '',
      })
      setLoading(false)
    }
  }, [profile, household])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !profile || !household) {
        setError('Not authenticated or missing data')
        setSaving(false)
        return
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName || null,
          last_name: formData.lastName || null,
          avatar_url: formData.avatarUrl || null,
        })
        .eq('id', user.id)

      if (profileError) {
        throw profileError
      }

      // Update email in auth if changed
      if (formData.email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        })

        if (emailError) {
          throw emailError
        }
      }

      // Update household
      const { error: householdError } = await supabase
        .from('households')
        .update({
          phone: formData.phone || null,
          address_line1: formData.addressLine1 || null,
          address_line2: formData.addressLine2 || null,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zipCode || null,
          emergency_contact_name: formData.emergencyContactName || null,
          emergency_contact_phone: formData.emergencyContactPhone || null,
        })
        .eq('id', household.id)

      if (householdError) {
        throw householdError
      }

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      })

      // Refresh the page to update the profile menu avatar
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to update profile'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Profile Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your personal information and preferences
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your profile information and photo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Image */}
            <div>
              <ImageUpload
                value={formData.avatarUrl}
                onChange={(url) => {
                  setFormData({ ...formData, avatarUrl: url || '' })
                }}
                bucket="profile-images"
                folder="avatars"
                maxSizeMB={2}
                label="Profile Picture"
              />
            </div>

            {/* First Name */}
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
              />
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Changing your email will require verification
              </p>
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            {/* Address Line 1 */}
            <div>
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input
                id="addressLine1"
                value={formData.addressLine1}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine1: e.target.value })
                }
              />
            </div>

            {/* Address Line 2 */}
            <div>
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                value={formData.addressLine2}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine2: e.target.value })
                }
              />
            </div>

            {/* City, State, Zip */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) =>
                    setFormData({ ...formData, zipCode: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyContactName">Name</Label>
                  <Input
                    id="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContactName: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyContactPhone">Phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContactPhone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
                  Cancel
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


