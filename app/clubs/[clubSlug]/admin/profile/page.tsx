'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRequireAdmin } from '@/lib/auth-context'
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
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

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

export default function AdminProfilePage() {
  const router = useRouter()
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile: authProfile, loading: authLoading } = useRequireAdmin()
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
      if (authLoading) return

      try {
        // PHASE 2: useRequireAdmin already provides profile, but we need full data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authProfile?.id || '')
          .single()

        if (profileError) {
          setError('Failed to load profile')
          setLoading(false)
          return
        }

        setProfile(profileData as ProfileData)
        setFormData({
          firstName: profileData.first_name || '',
          lastName: profileData.last_name || '',
          email: profileData.email || '',
          phone: '',
          avatarUrl: profileData.avatar_url || '',
        })

        // Also check if user is a coach and load coach data
        const { data: coachDataResult } = await supabase
          .from('coaches')
          .select('phone')
          .eq('user_id', profileData.id)
          .maybeSingle()

        if (coachDataResult) {
          setCoachData(coachDataResult as CoachData)
          setFormData((prev) => ({
            ...prev,
            phone: coachDataResult.phone || '',
          }))
        }

        setLoading(false)
      } catch (err) {
        console.error('Error loading profile:', err)
        setError('Failed to load profile')
        setLoading(false)
      }
    }

    loadProfile()
  }, [authLoading, authProfile])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (!profile) {
        setError('Profile not loaded')
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
        .eq('id', profile.id)

      if (profileError) {
        throw profileError
      }

      // Update coach data if exists
      if (coachData) {
        const { error: coachError } = await supabase
          .from('coaches')
          .update({
            phone: formData.phone || null,
          })
          .eq('user_id', profile.id)

        if (coachError) {
          console.error('Error updating coach data:', coachError)
          // Don't throw - coach update is optional
        }
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      })

      // Refresh page data
      router.refresh()
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  // Show loading state
  if (authLoading || loading) {
    return <InlineLoading message="Loading profile…" />
  }

  // Show error state
  if (error && !profile) {
    return <ErrorState error={error} onRetry={() => router.refresh()} />
  }

  // Auth check ensures profile exists
  if (!authProfile || !profile) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Profile Settings"
        description="Manage your personal information and profile"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your name, email, and profile picture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label>Profile Picture</Label>
              <div className="mt-2">
                <ImageUpload
                  value={formData.avatarUrl}
                  onChange={(url) => {
                    setFormData({ ...formData, avatarUrl: url || '' })
                  }}
                  bucket="profile-images"
                  folder="avatars"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-gray-50"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Email cannot be changed here. Contact support to change your
                email.
              </p>
            </div>

            {coachData && (
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
            )}

            <div className="flex gap-3 justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


