'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAdminClub } from '@/lib/use-admin-club'
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

export default function BrandingPage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()
  const { club, loading: clubLoading, refreshClub } = useClub()
  const { toast: showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [primaryColor, setPrimaryColor] = useState('#3B82F6')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // Load existing club branding data
  useEffect(() => {
    if (club && !clubLoading) {
      setPrimaryColor(club.primary_color || '#3B82F6')
      setLogoUrl(club.logo_url || null)
    }
  }, [club, clubLoading])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    if (!clubId) {
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

      const { data: updatedClub, error: updateError } = await supabase
        .from('clubs')
        .update(updateData)
        .eq('id', clubId)
        .select()
        .single()

      if (updateError) {
        console.error('Update error:', updateError)
        setError(updateError.message || 'Failed to update club branding')
        setLoading(false)
        return
      }

      console.log('Club branding updated successfully:', updatedClub)

      // Refresh club context to show updated branding immediately
      await refreshClub()

      setSuccess(true)
      showToast({
        title: 'Branding updated',
        description: 'Your club branding has been updated successfully',
      })

      // Clear success message after a few seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Error updating club branding:', err)
      setError(err instanceof Error ? err.message : 'Failed to update club branding')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || clubLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <Alert variant="destructive">
          <AlertDescription>{authError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Club Branding</h2>
        <p className="text-muted-foreground">
          Customize your club's logo and primary color
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding Settings</CardTitle>
          <CardDescription>
            Update your club's visual identity. Changes will be reflected across the admin portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>
                  Branding updated successfully! Changes are now visible.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-20 h-10"
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
                <p className="text-xs text-muted-foreground">
                  Used for branding and UI personalization throughout the admin portal
                </p>
                {/* Color preview */}
                <div className="mt-2">
                  <div
                    className="h-12 w-full rounded-md border border-slate-200"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <ImageUpload
                  value={logoUrl}
                  onChange={(url) => {
                    console.log('ImageUpload onChange called with URL:', url)
                    setLogoUrl(url)
                  }}
                  bucket="club-logos"
                  folder="logos"
                  maxSizeMB={5}
                />
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-muted-foreground">
                    Debug: logoUrl = {logoUrl || 'null'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Reset to current club values
                  if (club) {
                    setPrimaryColor(club.primary_color || '#3B82F6')
                    setLogoUrl(club.logo_url || null)
                  }
                }}
                disabled={loading}
              >
                Reset
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            See how your branding will appear
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Club logo preview"
                  className="h-16 w-16 rounded-md object-cover border border-slate-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div
                  className="h-16 w-16 rounded-md border border-slate-200 flex items-center justify-center text-2xl font-semibold"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor,
                  }}
                >
                  {club?.name?.charAt(0).toUpperCase() || 'C'}
                </div>
              )}
              <div>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: primaryColor }}
                >
                  {club?.name || 'Club Name'}
                </h3>
                <p className="text-sm text-muted-foreground">Admin Portal</p>
              </div>
            </div>
            <div
              className="h-2 w-full rounded"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
