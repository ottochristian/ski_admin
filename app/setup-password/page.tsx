'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

export default function SetupPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        // No session - redirect to login
        router.push('/login?message=Please log in to set your password')
        return
      }

      // User is logged in (likely via invite link)
      // Check if they already have a password by checking if they can sign in with password
      // For invited users, they typically don't have a password set initially
      // We'll show the password setup form - if they already have a password, 
      // they can just set a new one or we can redirect them
      
      // Check user metadata to see if password was already set
      const user = session.user
      const hasPasswordSet = user.user_metadata?.password_set === true

      if (hasPasswordSet) {
        // Password already set - redirect to appropriate dashboard
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, club_id')
          .eq('id', user.id)
          .single()

        if (profileData) {
          if (profileData.role === 'system_admin') {
            router.push('/system-admin')
            return
          } else if (profileData.role === 'admin') {
            // Get club slug for club-aware route
            if (profileData.club_id) {
              const { data: club } = await supabase
                .from('clubs')
                .select('slug')
                .eq('id', profileData.club_id)
                .single()

              if (club?.slug) {
                router.push(`/clubs/${club.slug}/admin`)
                return
              }
            }
            // Fallback to legacy route if no club
            router.push('/admin')
            return
          } else if (profileData.role === 'coach') {
            router.push('/coach')
            return
          } else if (profileData.role === 'parent' && profileData.club_id) {
            const { data: club } = await supabase
              .from('clubs')
              .select('slug')
              .eq('id', profileData.club_id)
              .single()

            if (club?.slug) {
              router.push(`/clubs/${club.slug}/parent/dashboard`)
              return
            }
          }
        }
        // Fallback - redirect to login
        router.push('/login')
        return
      }

      // User needs to set password
      setNeedsPassword(true)
      setMessage('Please set a password for your account')
      setCheckingSession(false)
    }

    checkUser()
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
      data: {
        password_set: true, // Mark that password has been set
      },
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Success - get user and redirect based on role
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Failed to get user information')
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role, club_id')
      .eq('id', user.id)
      .single()

    if (profileData) {
      if (profileData.role === 'system_admin') {
        router.push('/system-admin')
        return
      } else if (profileData.role === 'admin') {
        // Get club slug for club-aware route
        if (profileData.club_id) {
          const { data: club } = await supabase
            .from('clubs')
            .select('slug')
            .eq('id', profileData.club_id)
            .single()

          if (club?.slug) {
            router.push(`/clubs/${club.slug}/admin`)
            return
          }
        }
        // Fallback to legacy route if no club
        router.push('/admin')
        return
      } else if (profileData.role === 'coach') {
        router.push('/coach')
        return
      } else if (profileData.role === 'parent') {
        if (profileData.club_id) {
          const { data: club } = await supabase
            .from('clubs')
            .select('slug')
            .eq('id', profileData.club_id)
            .single()

          if (club?.slug) {
            router.push(`/clubs/${club.slug}/parent/dashboard`)
            return
          }
        }
      }
    }

    // Fallback - redirect to login
    router.push('/login?message=Password set successfully. Please log in.')
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Checking your session...</p>
        </div>
      </div>
    )
  }

  if (!needsPassword) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Please set a password for your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert className="mb-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Enter your password"
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters long
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Confirm your password"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting password...
                </>
              ) : (
                'Set Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
