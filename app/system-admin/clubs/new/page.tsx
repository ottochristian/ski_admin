'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NewClubPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useSystemAdmin()
  const { toast: showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#3B82F6')
  const [address, setAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [timezone, setTimezone] = useState('America/Denver')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    // Generate slug: lowercase, replace spaces with hyphens, remove special chars
    const generatedSlug = value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(generatedSlug)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

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

    // Validate slug format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens')
      setLoading(false)
      return
    }

    // Validate email if provided
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError('Invalid email format')
      setLoading(false)
      return
    }

    // Validate color format if provided
    if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      setError('Primary color must be a valid hex color (e.g., #3B82F6)')
      setLoading(false)
      return
    }

    try {
      const { data, error: insertError } = await supabase
        .from('clubs')
        .insert([
          {
            name: name.trim(),
            slug: slug.trim(),
            primary_color: primaryColor || '#3B82F6',
            address: address.trim() || null,
            contact_email: contactEmail.trim() || null,
            timezone: timezone || 'America/Denver',
            logo_url: logoUrl?.trim() || null,
          },
        ])
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          // Unique constraint violation (slug already exists)
          setError(`A club with the slug "${slug}" already exists. Please choose a different slug.`)
        } else {
          setError(insertError.message || 'Failed to create club')
        }
        setLoading(false)
        return
      }

      showToast({
        title: 'Success',
        description: `Club "${name}" created successfully`,
      })

      // Redirect to clubs list
      router.push('/system-admin/clubs')
    } catch (err) {
      console.error('Error creating club:', err)
      setError('An unexpected error occurred')
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
          <h2 className="text-2xl font-bold text-slate-900">Create New Club</h2>
          <p className="text-muted-foreground">Add a new club to the system</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Club Information</CardTitle>
          <CardDescription>Enter the details for the new club</CardDescription>
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
                  placeholder="Jackson Hole Ski Club"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The display name for this club
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Slug <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="jackson-hole"
                  required
                  pattern="[a-z0-9-]+"
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier (auto-generated from name, lowercase letters, numbers, and hyphens only)
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
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for branding and UI personalization
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
                  onChange={setLogoUrl}
                  bucket="club-logos"
                  folder="logos"
                  maxSizeMB={5}
                />
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
              <Button type="button" variant="outline" asChild>
                <Link href="/system-admin/clubs">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Club
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
