'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystemAdmin } from '@/lib/use-system-admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserCheck, Key } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { CreateClubAdminDialog } from '@/components/create-club-admin-dialog'

type ClubAdmin = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  club_id: string
  club_name: string | null
  created_at: string
  last_sign_in_at: string | null
}

type Club = {
  id: string
  name: string
  slug: string
}

export default function AdminsPage() {
  const { profile, loading: authLoading } = useSystemAdmin()
  const [loading, setLoading] = useState(true)
  const [admins, setAdmins] = useState<ClubAdmin[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [error, setError] = useState<string | null>(null)
  const [resettingPassword, setResettingPassword] = useState<string | null>(null)

  const loadAdmins = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load all clubs first
      const { data: clubsData } = await supabase
        .from('clubs')
        .select('id, name, slug')
        .order('name', { ascending: true })

      if (clubsData) {
        setClubs(clubsData)
      }

      // Load all admin profiles with their clubs
      const { data: adminsData, error: adminsError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          club_id,
          created_at,
          clubs (
            name
          )
        `)
        .eq('role', 'admin')
        .order('created_at', { ascending: false })

      if (adminsError) {
        setError(adminsError.message)
        setLoading(false)
        return
      }

      // Get last sign in from auth.users via API route
      const adminsWithSignIn = await Promise.all(
        (adminsData || []).map(async (admin) => {
          let lastSignIn = null
          try {
            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session?.access_token) {
              // Call API route with auth token
              const response = await fetch(`/api/admin/users/${admin.id}/last-sign-in`, {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              })
              
              if (response.ok) {
                const data = await response.json()
                lastSignIn = data.last_sign_in_at || null
              }
            }
          } catch (err) {
            // Skip if API call fails
            console.error('Error fetching last sign-in for admin:', admin.id, err)
          }

          return {
            id: admin.id,
            email: admin.email,
            first_name: admin.first_name,
            last_name: admin.last_name,
            club_id: admin.club_id,
            club_name: (admin.clubs as any)?.name || 'No Club',
            created_at: admin.created_at,
            last_sign_in_at: lastSignIn,
          }
        })
      )

      setAdmins(adminsWithSignIn)
    } catch (err) {
      console.error('Error loading admins:', err)
      setError('Failed to load admins')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    loadAdmins()
  }, [authLoading])

  async function handleResetPassword(adminId: string, email: string) {
    try {
      setResettingPassword(adminId)

      // Generate a reset link (this requires admin API access)
      // For now, we'll use the Supabase admin API to send a password reset email
      const { error } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: email,
      })

      if (error) {
        alert(`Failed to reset password: ${error.message}`)
        return
      }

      alert(`Password reset email sent to ${email}`)
    } catch (err) {
      console.error('Error resetting password:', err)
      alert('Failed to reset password')
    } finally {
      setResettingPassword(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading admins...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Club Admins</h2>
          <p className="text-muted-foreground">Manage club administrators across all clubs</p>
        </div>
        <CreateClubAdminDialog clubs={clubs} onSuccess={loadAdmins} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Club Administrators</CardTitle>
          <CardDescription>{admins.length} administrators total</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No administrators found
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      {admin.first_name || admin.last_name
                        ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim()
                        : '—'}
                    </TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>{admin.club_name}</TableCell>
                    <TableCell>
                      {admin.last_sign_in_at
                        ? new Date(admin.last_sign_in_at).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {new Date(admin.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={resettingPassword === admin.id}
                          >
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Password</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will send a password reset email to{' '}
                              <strong>{admin.email}</strong>. They will be able to set a new
                              password via the link in the email.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleResetPassword(admin.id, admin.email)}
                            >
                              Send Reset Email
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
