'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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
import { AdminPageHeader } from '@/components/admin-page-header'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface ProfileData {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

interface CoachData {
  phone?: string | null
}

export default function CoachProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [coachData, setCoachData] = useState<CoachData | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatarUrl: '',
  })

  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.push('/login')
          return
        }

        // Load profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setError('Failed to load profile')
          return
        }

        setProfile(profileData as ProfileData)

        // Load coach data
        const { data: coach, error: coachError } = await supabase
          .from('coaches')
          .select('phone')
          .eq('profile_id', user.id)
          .maybeSingle()

        if (coachError) {
          console.error('Error loading coach data:', coachError)
        }

        if (coach) {
          setCoachData(coach as CoachData)
        }

        // Populate form
        setFormData({
          firstName: profileData.first_name || '',
          lastName: profileData.last_name || '',
          email: profileData.email || '',
          phone: coach?.phone || '',
          avatarUrl: profileData.avatar_url || '',
        })
      } catch (err) {
        console.error('Error loading profile:', err)
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !profile) {
        setError('Not authenticated')
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

      // Update coach phone
      if (coachData) {
        const { error: coachError } = await supabase
          .from('coaches')
          .update({
            phone: formData.phone || null,
          })
          .eq('profile_id', user.id)

        if (coachError) {
          console.error('Error updating coach phone:', coachError)
        }
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
            <Link href="/coach">
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
          <Link href="/coach">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <AdminPageHeader
          title="Profile Settings"
          description="Manage your personal information and preferences"
        />
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
                <Link href="/coach">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

