'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAdminClub } from '@/lib/use-admin-club'
import { clubQuery, withClubData } from '@/lib/supabase-helpers'
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

    if (!clubId) {
      setError('Club ID is required')
      setSaving(false)
      return
    }

    try {
      const { error: insertError } = await clubQuery(
        supabase
          .from('coaches')
          .insert(
            withClubData(
              {
                first_name: formData.firstName,
                last_name: formData.lastName,
                email: formData.email || null,
                phone: formData.phone || null,
              },
              clubId
            )
          ),
        clubId
      )

      if (insertError) {
        throw insertError
      }

      router.push('/admin/coaches')
    } catch (err) {
      console.error('Error creating coach:', err)
      setError(err instanceof Error ? err.message : 'Failed to create coach')
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
        <h1 className="text-3xl font-bold tracking-tight">Add Coach</h1>
        <p className="text-muted-foreground">Add a new coach to your club</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coach Information</CardTitle>
          <CardDescription>Enter the coach's basic information</CardDescription>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e =>
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

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Coach'}
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
