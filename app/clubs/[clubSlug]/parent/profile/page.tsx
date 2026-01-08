'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useParentClub } from '@/lib/use-parent-club'
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
import { toast } from 'sonner'
import { ArrowLeft, UserPlus, X, Mail, CheckCircle2, RefreshCw } from 'lucide-react'
import {
  useHouseholdGuardians,
  usePendingGuardianInvitations,
  useInviteGuardian,
  useRemoveGuardian,
  useCancelGuardianInvitation,
  useResendGuardianInvitation,
} from '@/lib/hooks/use-household-guardians'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { InlineLoading } from '@/components/ui/loading-states'

interface ProfileData {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

interface HouseholdData {
  id: string
  phone?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
}

export default function ParentProfilePage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, household } = useParentClub()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Guardian management hooks
  const { data: guardians = [], isLoading: guardiansLoading } = useHouseholdGuardians(household?.id)
  const { data: pendingInvitations = [], isLoading: invitationsLoading } = usePendingGuardianInvitations(household?.id)
  const inviteGuardian = useInviteGuardian()
  const removeGuardian = useRemoveGuardian()
  const cancelInvitation = useCancelGuardianInvitation()
  const resendInvitation = useResendGuardianInvitation()
  
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  
  // Check if current user is primary guardian
  const isPrimaryGuardian = guardians.some(
    (g) => g.user_id === profile?.id && g.is_primary
  )
  
  // Current guardian count (including pending invitations)
  const guardianCount = guardians.length + pendingInvitations.length
  const canInvite = isPrimaryGuardian && guardianCount < 3
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    avatarUrl: '',
  })
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Only initialize once when profile/household data first becomes available
    if (profile && !isInitialized) {
      setFormData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: profile.email || '',
        phone: household?.phone || '',
        addressLine1: household?.address_line1 || '',
        addressLine2: household?.address_line2 || '',
        city: household?.city || '',
        state: household?.state || '',
        zipCode: household?.zip_code || '',
        emergencyContactName: household?.emergency_contact_name || '',
        emergencyContactPhone: household?.emergency_contact_phone || '',
        avatarUrl: profile.avatar_url || '',
      })
      setLoading(false)
      setIsInitialized(true)
    } else if (!profile) {
      setLoading(false)
    }
    // Only depend on the actual ID values, not the entire objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, household?.id, isInitialized])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !profile || !household) {
        setError('Not authenticated or missing data')
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

      // Update household
      const { error: householdError } = await supabase
        .from('households')
        .update({
          phone: formData.phone || null,
          address_line1: formData.addressLine1 || null,
          address_line2: formData.addressLine2 || null,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zipCode || null,
          emergency_contact_name: formData.emergencyContactName || null,
          emergency_contact_phone: formData.emergencyContactPhone || null,
        })
        .eq('id', household.id)

      if (householdError) {
        throw householdError
      }

      toast.success('Profile updated', {
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
            <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
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
          <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Profile Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your personal information and preferences
          </p>
        </div>
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

            {/* Address Line 1 */}
            <div>
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input
                id="addressLine1"
                value={formData.addressLine1}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine1: e.target.value })
                }
              />
            </div>

            {/* Address Line 2 */}
            <div>
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                value={formData.addressLine2}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine2: e.target.value })
                }
              />
            </div>

            {/* City, State, Zip */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) =>
                    setFormData({ ...formData, zipCode: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyContactName">Name</Label>
                  <Input
                    id="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContactName: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyContactPhone">Phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContactPhone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
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
                <Link href={`/clubs/${clubSlug}/parent/dashboard`}>
                  Cancel
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Household Guardians Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Household Guardians</CardTitle>
              <CardDescription>
                Manage secondary guardians for your household. Maximum of 3 guardians total.
              </CardDescription>
            </div>
            {canInvite && (
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Guardian
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Secondary Guardian</DialogTitle>
                    <DialogDescription>
                      Enter the email address of the person you want to invite as a secondary guardian.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="inviteEmail">Email Address</Label>
                      <Input
                        id="inviteEmail"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="guardian@example.com"
                        required
                      />
                    </div>
                    {inviteGuardian.isError && (
                      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {inviteGuardian.error instanceof Error
                          ? inviteGuardian.error.message
                          : 'Failed to send invitation'}
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsInviteDialogOpen(false)
                          setInviteEmail('')
                        }}
                        disabled={inviteGuardian.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!inviteEmail.trim()) return
                          
                          try {
                            await inviteGuardian.mutateAsync(inviteEmail.trim())
                            toast.success('Invitation sent!', {
                              description: `An invitation email has been sent to ${inviteEmail.trim()}`,
                            })
                            setInviteEmail('')
                            setIsInviteDialogOpen(false)
                          } catch (err) {
                            // Error is handled by the error state
                          }
                        }}
                        disabled={inviteGuardian.isPending || !inviteEmail.trim()}
                      >
                        {inviteGuardian.isPending ? 'Sending...' : 'Send Invitation'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {guardiansLoading || invitationsLoading ? (
            <InlineLoading message="Loading guardians..." />
          ) : (
            <div className="space-y-4">
              {/* Current Guardians */}
              {guardians.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Current Guardians</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guardians.map((guardian) => {
                        const guardianProfile = guardian.profiles
                        const isCurrentUser = guardian.user_id === profile?.id
                        const canRemove = isPrimaryGuardian && !guardian.is_primary && !isCurrentUser

                        return (
                          <TableRow key={guardian.id}>
                            <TableCell>
                              {guardianProfile?.first_name || guardianProfile?.last_name
                                ? `${guardianProfile.first_name || ''} ${guardianProfile.last_name || ''}`.trim()
                                : 'Unknown'}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                              )}
                            </TableCell>
                            <TableCell>{guardianProfile?.email || 'N/A'}</TableCell>
                            <TableCell>
                              {guardian.is_primary ? (
                                <Badge variant="default">Primary</Badge>
                              ) : (
                                <Badge variant="secondary">Secondary</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {canRemove && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (
                                      confirm(
                                        `Are you sure you want to remove ${guardianProfile?.email} as a guardian?`
                                      )
                                    ) {
                                      try {
                                        await removeGuardian.mutateAsync(guardian.id)
                                        toast.success('Guardian removed', {
                                          description: `${guardianProfile?.email} has been removed from your household.`,
                                        })
                                      } catch (err) {
                                        toast.error('Error', {
                                          description:
                                            err instanceof Error
                                              ? err.message
                                              : 'Failed to remove guardian',
                                        })
                                      }
                                    }
                                  }}
                                  disabled={removeGuardian.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <div>
                  {guardians.length > 0 && <Separator className="my-4" />}
                  <h3 className="text-sm font-semibold mb-3">Pending Invitations</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {invitation.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(invitation.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {new Date(invitation.expires_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {isPrimaryGuardian && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await resendInvitation.mutateAsync(invitation.id)
                                      toast.success('Invitation resent!', {
                                        description: `A new invitation has been sent to ${invitation.email}.`,
                                      })
                                    } catch (err) {
                                      toast.error('Error', {
                                        description:
                                          err instanceof Error
                                            ? err.message
                                            : 'Failed to resend invitation',
                                      })
                                    }
                                  }}
                                  disabled={resendInvitation.isPending}
                                  title="Resend invitation"
                                >
                                  <RefreshCw className={`h-4 w-4 ${resendInvitation.isPending ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await cancelInvitation.mutateAsync(invitation.id)
                                      toast.success('Invitation cancelled', {
                                        description: `Invitation to ${invitation.email} has been cancelled.`,
                                      })
                                    } catch (err) {
                                      toast.error('Error', {
                                        description:
                                          err instanceof Error
                                            ? err.message
                                            : 'Failed to cancel invitation',
                                      })
                                    }
                                  }}
                                  disabled={cancelInvitation.isPending}
                                  title="Cancel invitation"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Empty State */}
              {guardians.length === 0 && pendingInvitations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No secondary guardians yet.</p>
                  {isPrimaryGuardian && (
                    <p className="text-sm mt-2">
                      Invite a secondary guardian to share household management responsibilities.
                    </p>
                  )}
                </div>
              )}

              {/* Guardian Count Warning */}
              {guardianCount >= 3 && (
                <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium">Maximum guardians reached</p>
                  <p className="text-xs mt-1">
                    Your household has reached the maximum of 3 guardians. Remove a guardian before inviting a new one.
                  </p>
                </div>
              )}

              {/* Info for secondary guardians */}
              {!isPrimaryGuardian && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
                  <p>
                    You are a secondary guardian. You have the same permissions as the primary guardian, but you cannot remove other guardians or invite new ones.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


