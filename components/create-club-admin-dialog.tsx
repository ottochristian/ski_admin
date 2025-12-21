'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Mail, UserSearch } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type Club = {
  id: string
  name: string
  slug: string
}

type User = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  club_id: string | null
}

interface CreateClubAdminDialogProps {
  clubs: Club[]
  onSuccess?: () => void
}

export function CreateClubAdminDialog({ clubs, onSuccess }: CreateClubAdminDialogProps) {
  const { toast: showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('invite')

  // Invite by email state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteClubId, setInviteClubId] = useState<string>('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')

  // Select existing user state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedClubId, setSelectedClubId] = useState<string>('')

  async function handleSearchUsers() {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, club_id')
        .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(10)

      if (error) {
        showToast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
        return
      }

      setSearchResults(data || [])
    } catch (err) {
      console.error('Error searching users:', err)
      showToast({
        title: 'Error',
        description: 'Failed to search users',
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
    }
  }

  async function handleInviteByEmail() {
    if (!inviteEmail || !inviteClubId) {
      showToast({
        title: 'Error',
        description: 'Please fill in email and select a club',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Get auth token for API route
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        showToast({
          title: 'Error',
          description: 'You must be logged in to invite users',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      // Call API route to invite user
      const response = await fetch('/api/system-admin/invite-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          firstName: inviteFirstName || null,
          lastName: inviteLastName || null,
          clubId: inviteClubId,
        }),
      })

      // Read response as text first (can only read once)
      const responseText = await response.text()
      let data: any = {}
      
      // Try to parse as JSON
      try {
        if (responseText) {
          data = JSON.parse(responseText)
        }
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError)
        console.error('Response text:', responseText)
        console.error('Response status:', response.status)
        console.error('Response headers:', Object.fromEntries(response.headers.entries()))
        
        showToast({
          title: 'Error',
          description: responseText || 'Invalid response from server. Check console for details.',
          variant: 'destructive',
        })
        return
      }

      if (!response.ok) {
        console.error('Invite API error:', data)
        let errorMessage = data.error || 'Failed to send invitation'
        
        // Provide helpful hint if it's a redirect URL issue
        if (data.hint) {
          errorMessage += `. ${data.hint}`
        }
        
        // Show full error details in console for debugging
        if (data.details) {
          console.error('Full error details:', data.details)
        }
        
        showToast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
        return
      }

      // Show success message with OTP code in dev mode
      const normalizedEmail = inviteEmail.toLowerCase().trim()
      let description = data.message || `Invitation sent to ${normalizedEmail}`
      if (data.code) {
        description += `\n\nDev Mode - OTP Code: ${data.code}\nSetup link: ${window.location.origin}/setup-password?email=${encodeURIComponent(normalizedEmail)}`
      }

      showToast({
        title: 'Success',
        description,
      })

      // Log setup link in console for easy access
      if (data.code) {
        console.log('🔐 Admin Invitation Details:')
        console.log('Email:', normalizedEmail)
        console.log('OTP Code:', data.code)
        console.log('Setup Link:', `${window.location.origin}/setup-password?email=${encodeURIComponent(normalizedEmail)}`)
      }

      // Reset form
      setInviteEmail('')
      setInviteFirstName('')
      setInviteLastName('')
      setInviteClubId('')
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      console.error('Error inviting user:', err)
      showToast({
        title: 'Error',
        description: 'Failed to send invitation',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectExistingUser() {
    if (!selectedUserId || !selectedClubId) {
      showToast({
        title: 'Error',
        description: 'Please select a user and a club',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Update user's role to admin and assign club
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'admin',
          club_id: selectedClubId,
        })
        .eq('id', selectedUserId)

      if (error) {
      showToast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
        return
      }

      showToast({
        title: 'Success',
        description: 'User role updated to admin',
      })

      // Reset form
      setSelectedUserId('')
      setSelectedClubId('')
      setSearchQuery('')
      setSearchResults([])
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      console.error('Error updating user:', err)
      showToast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Club Admin</DialogTitle>
          <DialogDescription>
            Invite a new user by email or select an existing user to make them an admin.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite">
              <Mail className="h-4 w-4 mr-2" />
              Invite by Email
            </TabsTrigger>
            <TabsTrigger value="existing">
              <UserSearch className="h-4 w-4 mr-2" />
              Select Existing User
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  placeholder="John"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  placeholder="Doe"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-club">Club *</Label>
              <Select value={inviteClubId} onValueChange={setInviteClubId}>
                <SelectTrigger id="invite-club">
                  <SelectValue placeholder="Select a club" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleInviteByEmail}
              disabled={loading || !inviteEmail || !inviteClubId}
              className="w-full"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>

            <p className="text-xs text-muted-foreground">
              User will receive an email invitation to set their password and access the admin
              portal.
            </p>
          </TabsContent>

          <TabsContent value="existing" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="search-users">Search Users</Label>
              <div className="flex gap-2">
                <Input
                  id="search-users"
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchUsers()
                    }
                  }}
                />
                <Button onClick={handleSearchUsers} disabled={searching} variant="outline">
                  Search
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <Label>Select User</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-100 transition-colors ${
                        selectedUserId === user.id ? 'bg-slate-100 border-l-2 border-purple-500' : ''
                      }`}
                    >
                      <div className="font-medium">
                        {user.first_name || user.last_name
                          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                          : user.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.email} • {user.role}
                        {user.club_id && ' • Has club'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="existing-club">Assign to Club *</Label>
              <Select value={selectedClubId} onValueChange={setSelectedClubId}>
                <SelectTrigger id="existing-club">
                  <SelectValue placeholder="Select a club" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSelectExistingUser}
              disabled={loading || !selectedUserId || !selectedClubId}
              className="w-full"
            >
              {loading ? 'Updating...' : 'Make Admin'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
