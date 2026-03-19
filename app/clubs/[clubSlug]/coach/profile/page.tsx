'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/coach`
  const [supabase] = useState(() => createClient())

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

    if (!formData.firstName || !formData.lastName) {
      setError('First name and last name are required')
      setSaving(false)
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !profile) {
        setError('Not authenticated')
        setSaving(false)
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          avatar_url: formData.avatarUrl || null,
        })
        .eq('id', user.id)

      if (profileError) {
        throw profileError
      }

      if (formData.email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        })

        if (emailError) {
          throw emailError
        }
      }

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
            <Link href={basePath}>
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
          <Link href={basePath}>
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

            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                required
                className={!formData.firstName ? 'border-red-300' : ''}
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
                className={!formData.lastName ? 'border-red-300' : ''}
              />
            </div>

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
                <Link href={basePath}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
