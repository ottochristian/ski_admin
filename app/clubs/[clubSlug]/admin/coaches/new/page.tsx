'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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
import Link from 'next/link'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

export default function NewCoachPage() {
  const router = useRouter()
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const basePath = `/clubs/${clubSlug}/admin`
  const { profile, loading: authLoading } = useRequireAdmin()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    if (!profile?.club_id) {
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
      setFormData({ firstName: '', lastName: '', email: '', phone: '' })

      // Redirect after 2 seconds (club-aware route)
      setTimeout(() => {
        router.push(`${basePath}/coaches`)
      }, 2000)
    } catch (err) {
      console.error('Error inviting coach:', err)
      setError(err instanceof Error ? err.message : 'Failed to send invitation')
      setSaving(false)
    }
  }

  // Show loading state
  if (authLoading) {
    return <InlineLoading message="Loading…" />
  }

  // Auth check ensures profile exists
  if (!profile) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invite Coach</h1>
          <p className="text-muted-foreground">
            Send an invitation email to a new coach
          </p>
        </div>
        <Link href={`${basePath}/coaches`}>
          <Button variant="outline">Back to Coaches</Button>
        </Link>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Coach Information</CardTitle>
          <CardDescription>
            Enter the coach's details. They will receive an email invitation to
            create their account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            )}

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

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
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

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Sending…' : 'Send Invitation'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`${basePath}/coaches`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

