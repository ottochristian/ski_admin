'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSystemAdmin } from '@/lib/use-system-admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/image-upload'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function EditClubPage() {
  const router = useRouter()
  const params = useParams()
  const clubId = params.clubId as string
  const { profile, loading: authLoading } = useSystemAdmin()
  const { toast: showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingClub, setLoadingClub] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#3B82F6')
  const [address, setAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [timezone, setTimezone] = useState('America/Denver')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // Debug: Log logoUrl changes
  useEffect(() => {
    console.log('logoUrl state changed to:', logoUrl)
  }, [logoUrl])

  // Load existing club data
  useEffect(() => {
    async function loadClub() {
      if (authLoading) return

      try {
        setLoadingClub(true)
        setError(null)

        const { data: clubData, error: clubError } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', clubId)
          .single()

        if (clubError) {
          setError(`Failed to load club: ${clubError.message}`)
          setLoadingClub(false)
          return
        }

        if (!clubData) {
          setError('Club not found')
          setLoadingClub(false)
          return
        }

        // Populate form with existing data
        setName(clubData.name || '')
        setSlug(clubData.slug || '')
        setPrimaryColor(clubData.primary_color || '#3B82F6')
        setAddress(clubData.address || '')
        setContactEmail(clubData.contact_email || '')
        setTimezone(clubData.timezone || 'America/Denver')
        setLogoUrl(clubData.logo_url || null)
      } catch (err) {
        console.error('Error loading club:', err)
        setError('Failed to load club')
      } finally {
        setLoadingClub(false)
      }
    }

    loadClub()
  }, [clubId, authLoading])

  // Auto-generate slug from name (but allow manual override)
  const handleNameChange = (value: string) => {
    setName(value)
    // Only auto-generate if slug is empty or matches the old name pattern
    if (!slug || slug === name.toLowerCase().replace(/\s+/g, '-')) {
      const generatedSlug = value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      setSlug(generatedSlug)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Debug: Log current state before submission
    console.log('Form submission - Current logoUrl state:', logoUrl)
    console.log('Form submission - All form state:', {
      name,
      slug,
      primaryColor,
      address,
      contactEmail,
      timezone,
      logoUrl,
    })

    // Validation
    if (!name.trim()) {
      setError('Club name is required')
      setLoading(false)
      return
    }

    if (!slug.trim()) {
      setError('Slug is required')
      setLoading(false)
      return
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens')
      setLoading(false)
      return
    }

    // Validate email if provided
    if (contactEmail && contactEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(contactEmail)) {
        setError('Please enter a valid contact email')
        setLoading(false)
        return
      }
    }

    // Validate color format
    const colorRegex = /^#[0-9A-Fa-f]{6}$/
    if (!colorRegex.test(primaryColor)) {
      setError('Please enter a valid hex color (e.g., #3B82F6)')
      setLoading(false)
      return
    }

    try {
      // Check if slug is already taken by another club
      const { data: existingClub, error: checkError } = await supabase
        .from('clubs')
        .select('id')
        .eq('slug', slug.trim())
        .neq('id', clubId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is what we want
        throw checkError
      }

      if (existingClub) {
        setError('A club with this slug already exists')
        setLoading(false)
        return
      }

      // Update club
      const updateData = {
        name: name.trim(),
        slug: slug.trim(),
        primary_color: primaryColor,
        address: address.trim() || null,
        contact_email: contactEmail.trim() || null,
        timezone: timezone.trim() || 'America/Denver',
        logo_url: logoUrl?.trim() || null,
      }
      console.log('Updating club with data:', updateData)
      console.log('logoUrl state value:', logoUrl)
      
      const { data: updatedClub, error: updateError } = await supabase
        .from('clubs')
        .update(updateData)
        .eq('id', clubId)
        .select()
        .single()

      if (updateError) {
        console.error('Update error:', updateError)
        setError(updateError.message || 'Failed to update club')
        setLoading(false)
        return
      }

      console.log('Club updated successfully:', updatedClub)
      console.log('Updated logo_url:', updatedClub?.logo_url)

      showToast({
        title: 'Club updated',
        description: `${name} has been updated successfully`,
      })

      // Refresh the page to ensure club context updates
      // This ensures the logo appears in the sidebar immediately
      router.refresh()
      
      // Redirect back to clubs list
      router.push('/system-admin/clubs')
    } catch (err) {
      console.error('Error updating club:', err)
      setError(err instanceof Error ? err.message : 'Failed to update club')
      setLoading(false)
    }
  }

  if (authLoading || loadingClub) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Loading club...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/system-admin/clubs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clubs
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Edit Club</h2>
          <p className="text-muted-foreground">Update club information</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Club Information</CardTitle>
          <CardDescription>Update the details for this club</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Club Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="My Ski Club"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Slug <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  placeholder="my-ski-club"
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier (lowercase, hyphens only)
                </p>
              </div>

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
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for branding and personalization
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@club.com"
                />
                <p className="text-xs text-muted-foreground">
                  Primary contact email for this club
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/Denver"
                />
                <p className="text-xs text-muted-foreground">
                  IANA timezone (e.g., America/Denver, America/New_York)
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <ImageUpload
                  value={logoUrl}
                  onChange={(url) => {
                    console.log('ImageUpload onChange called with URL:', url)
                    console.log('Setting logoUrl state to:', url)
                    setLogoUrl(url)
                    // Verify state was set
                    setTimeout(() => {
                      console.log('logoUrl state after update:', logoUrl)
                    }, 100)
                  }}
                  bucket="club-logos"
                  folder="logos"
                  maxSizeMB={5}
                />
                {/* Debug: Show current logoUrl state */}
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-muted-foreground">
                    Debug: logoUrl = {logoUrl || 'null'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, City, State 12345"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/system-admin/clubs')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Club'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
