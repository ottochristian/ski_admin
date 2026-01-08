'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAcceptGuardianInvitation } from '@/lib/hooks/use-household-guardians'
import { toast } from 'sonner'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'
import { CheckCircle2, XCircle, LogIn } from 'lucide-react'

export default function AcceptGuardianInvitationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [hasAccepted, setHasAccepted] = useState(false)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clubId, setClubId] = useState<string | null>(null)
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null)

  const {
    mutate: acceptInvitation,
    isPending,
    isError,
    error,
  } = useAcceptGuardianInvitation()

  // Check authentication status first
  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setIsAuthenticated(!!user)
      } catch (err) {
        setIsAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [])

  // Fetch club_id and email from invitation if not authenticated
  useEffect(() => {
    async function fetchInvitationInfo() {
      if (!token || isAuthenticated || isCheckingAuth) return
      
      try {
        const response = await fetch(`/api/household-guardians/invitation-info?token=${token}`)
        if (response.ok) {
          const data = await response.json()
          if (data.clubId) {
            setClubId(data.clubId)
          }
          if (data.email) {
            setInvitationEmail(data.email)
          }
        }
      } catch (err) {
        console.error('Error fetching invitation info:', err)
      }
    }

    fetchInvitationInfo()
  }, [token, isAuthenticated, isCheckingAuth])

  // Auto-accept on mount if token is present AND user is authenticated
  useEffect(() => {
    if (!token || !isAuthenticated || isCheckingAuth) {
      return
    }

    // Auto-accept on mount if token is present and user is authenticated
    acceptInvitation(token, {
      onSuccess: (data) => {
        setHasAccepted(true)
        if (data.redirectTo) {
          setRedirectTo(data.redirectTo)
          toast.success('Invitation accepted!', {
            description: data.message || 'You are now a guardian for this household.',
          })
          // Redirect after a short delay
          setTimeout(() => {
            router.push(data.redirectTo)
          }, 2000)
        }
      },
      onError: (err) => {
        // Error is handled by the error state
      },
    })
  }, [token, isAuthenticated, isCheckingAuth, acceptInvitation, router])

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Checking Authentication</CardTitle>
            <CardDescription>Please wait...</CardDescription>
          </CardHeader>
          <CardContent>
            <InlineLoading message="Verifying..." />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              No invitation token provided. Please use the link from your invitation email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If not authenticated, show login prompt
  if (!isAuthenticated) {
    const redirectPath = `/accept-guardian-invitation?token=${token}`
    const loginUrl = `/login?redirect=${encodeURIComponent(redirectPath)}`
    
    // Build signup URL with clubId and email if available
    const signupParams = new URLSearchParams()
    signupParams.set('redirect', redirectPath)
    if (clubId) {
      signupParams.set('clubId', clubId)
    }
    if (invitationEmail) {
      signupParams.set('email', invitationEmail)
    }
    const signupUrl = `/signup?${signupParams.toString()}`

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Login Required</CardTitle>
            </div>
            <CardDescription>
              You need to be logged in to accept this guardian invitation. If you don't have an account yet, you can sign up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href={loginUrl} className="block">
              <Button className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                Log In
              </Button>
            </Link>
            <Link href={signupUrl} className="block">
              <Button variant="outline" className="w-full">
                Create Account
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-4">
              After logging in or signing up, you'll be redirected back here to accept the invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (hasAccepted && redirectTo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle>Invitation Accepted!</CardTitle>
            </div>
            <CardDescription>
              You are now a guardian for this household. Redirecting you...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={redirectTo}>
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Accepting Invitation</CardTitle>
            <CardDescription>Please wait while we process your invitation...</CardDescription>
          </CardHeader>
          <CardContent>
            <InlineLoading message="Processing..." />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <CardTitle>Invitation Failed</CardTitle>
            </div>
            <CardDescription>
              {error instanceof Error ? error.message : 'Failed to accept invitation'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Possible reasons:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The invitation token has expired</li>
                <li>You are already a guardian in another household</li>
                <li>The household has reached its guardian limit</li>
                <li>The invitation was cancelled</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Link href="/login" className="flex-1">
                <Button variant="outline" className="w-full">Go to Login</Button>
              </Link>
              <Button
                onClick={() => {
                  acceptInvitation(token)
                }}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

