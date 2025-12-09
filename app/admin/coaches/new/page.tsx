'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAdminClub } from '@/lib/use-admin-club'
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
import Link from 'next/link'

export default function NewCoachPage() {
  const router = useRouter()
  const { clubId, loading: authLoading, error: authError } = useAdminClub()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (authError) {
      setError(authError)
      setLoading(false)
      return
    }

    setLoading(false)
  }, [authLoading, authError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    if (!clubId) {
      setError('Club ID is required')
      setSaving(false)
      return
    }

    if (!formData.email) {
      setError('Email is required to send invitation')
      setSaving(false)
      return
    }

    try {
      // Get auth token for API request
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setError('You must be logged in to invite coaches')
        setSaving(false)
        return
      }

      // Call the invite API route
      const response = await fetch('/api/coaches/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      setSuccess(data.message || `Invitation sent to ${formData.email}`)

      // Clear form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
      })

      // Redirect after a short delay to show success message
      setTimeout(() => {
        router.push('/admin/coaches')
      }, 2000)
    } catch (err) {
      console.error('Error inviting coach:', err)
      setError(err instanceof Error ? err.message : 'Failed to invite coach')
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || authError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || authError}</p>
          <Button asChild variant="outline">
            <Link href="/admin/coaches">Back to Coaches</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invite Coach</h1>
        <p className="text-muted-foreground">
          Send an invitation email to a new coach. They will receive a link to set their password and complete their profile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coach Information</CardTitle>
          <CardDescription>
            Enter the coach's information. They will receive an email invitation to set up their account.
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
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                placeholder="coach@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                An invitation email will be sent to this address
              </p>
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={e =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm text-green-800 dark:text-green-200">
                {success}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Sending Invitation...' : 'Send Invitation'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/coaches">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
