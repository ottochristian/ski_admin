'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRequireAdmin } from '@/lib/auth-context'
import { useClub } from '@/lib/club-context'
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
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

export default function BrandingPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useRequireAdmin()
  const { club, loading: clubLoading, refreshClub } = useClub()
  const { toast: showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [primaryColor, setPrimaryColor] = useState('#3B82F6')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // Load existing club branding data
  // Use stable club properties instead of club object to avoid infinite loops
  useEffect(() => {
    if (club && !clubLoading) {
      // Only update if values actually changed to prevent unnecessary re-renders
      setPrimaryColor((prev) => {
        const newColor = club.primary_color || '#3B82F6'
        return prev !== newColor ? newColor : prev
      })
      setLogoUrl((prev) => {
        const newUrl = club.logo_url || null
        return prev !== newUrl ? newUrl : prev
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.id, club?.primary_color, club?.logo_url, clubLoading])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    if (!profile?.club_id) {
      setError('No club associated with your account')
      setLoading(false)
      return
    }

    // Validate color format
    const colorRegex = /^#[0-9A-Fa-f]{6}$/
    if (!colorRegex.test(primaryColor)) {
      setError('Please enter a valid hex color (e.g., #3B82F6)')
      setLoading(false)
      return
    }

    try {
      const updateData = {
        primary_color: primaryColor,
        logo_url: logoUrl?.trim() || null,
      }

      console.log('Updating club branding:', updateData)

      // PHASE 2: RLS ensures user can only update their club
      const { data: updatedClub, error: updateError } = await supabase
        .from('clubs')
        .update(updateData)
        .eq('id', profile.club_id)
        .select()
        .single()

      if (updateError) {
        console.error('Update error:', updateError)
        setError(updateError.message || 'Failed to update club branding')
        setLoading(false)
        return
      }

      setSuccess(true)
      refreshClub() // Refresh club context

      showToast({
        title: 'Success',
        description: 'Club branding updated successfully',
      })

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (err) {
      console.error('Error updating branding:', err)
      setError('An unexpected error occurred')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const isLoading = authLoading || clubLoading

  // Show loading state
  if (isLoading) {
    return <InlineLoading message="Loading club branding…" />
  }

  // Show error state
  if (error && !success) {
    return <ErrorState error={error} onRetry={() => router.refresh()} />
  }

  // Auth check ensures profile exists
  if (!profile || !club) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Club Branding</h1>
        <p className="text-muted-foreground">
          Customize your club's visual identity
        </p>
      </div>

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            Club branding updated successfully!
          </AlertDescription>
        </Alert>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Branding Settings</CardTitle>
          <CardDescription>
            Set your club's primary color and logo. These will be used throughout
            the portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-20 rounded border cursor-pointer"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3B82F6"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a hex color for your club's primary brand color
              </p>
            </div>

            <div>
              <Label>Club Logo</Label>
              <div className="mt-2">
                <ImageUpload
                  value={logoUrl}
                  onChange={(url) => {
                    setLogoUrl(url)
                    setSuccess(false) // Reset success state
                  }}
                  bucket="club-logos"
                  folder="logos"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Upload your club's logo. Recommended size: 200x200px or larger.
              </p>
            </div>

            {error && !success && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
