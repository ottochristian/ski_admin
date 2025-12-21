'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { OTPInput } from '@/components/ui/otp-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, Mail } from 'lucide-react'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailFromUrl = searchParams.get('email')
  
  // Handle URL decoding issues: spaces should be + signs in emails, lowercase for consistency
  const cleanEmail = emailFromUrl ? emailFromUrl.replace(/\s+/g, '+').toLowerCase() : ''

  const [email, setEmail] = useState(cleanEmail || '')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (emailFromUrl) {
      // Clean email: replace spaces with +, lowercase for consistency
      const cleaned = emailFromUrl.replace(/\s+/g, '+').toLowerCase()
      setEmail(cleaned)
    }
  }, [emailFromUrl])

  async function handleVerifyOTP() {
    if (!email || !otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    // Prevent duplicate calls
    if (loading) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get user ID by email via API (avoids RLS issues)
      const userResponse = await fetch('/api/auth/get-user-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const userData = await userResponse.json()

      if (!userResponse.ok || !userData.success) {
        setError('No account found for this email address.')
        setLoading(false)
        return
      }

      const user = { id: userData.userId }

      // Verify OTP via API
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          code: otp,
          type: 'email_verification',
          contact: email
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Invalid or expired code')
        setAttemptsRemaining(data.attemptsRemaining)
        setLoading(false)
        return
      }

      // OTP verified! Update profile to mark email as verified
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ email_verified_at: new Date().toISOString() })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating profile:', updateError)
      }

      // Create session for auto-login
      const sessionResponse = await fetch('/api/auth/create-session-after-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })

      const sessionData = await sessionResponse.json()

      if (!sessionResponse.ok || !sessionData.success) {
        console.error('Failed to create session:', sessionData.error)
        setSuccess('Email verified! Redirecting to login...')
        setTimeout(() => {
          router.push('/login?message=Email verified! You can now log in.')
        }, 2000)
        return
      }

      // Use the token to verify and create a session
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: sessionData.token,
        type: 'email'
      })

      if (verifyError) {
        console.error('Error verifying session token:', verifyError)
        setSuccess('Email verified! Redirecting to login...')
        setTimeout(() => {
          router.push('/login?message=Email verified! You can now log in.')
        }, 2000)
        return
      }

      // Get user's profile to determine role and redirect
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, club_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('Error fetching profile:', profileError)
        setSuccess('Email verified! Redirecting...')
        setTimeout(() => {
          router.push('/')
        }, 1500)
        return
      }

      setSuccess('Email verified! Redirecting to your portal...')
      
      // Small delay for UX, then redirect based on role
      setTimeout(async () => {
        if (profile.role === 'system_admin') {
          router.push('/system-admin')
        } else if (profile.role === 'admin') {
          if (profile.club_id) {
            const { data: club } = await supabase
              .from('clubs')
              .select('slug')
              .eq('id', profile.club_id)
              .single()
            
            if (club?.slug) {
              router.push(`/clubs/${club.slug}/admin`)
            } else {
              router.push('/admin')
            }
          } else {
            router.push('/admin')
          }
        } else if (profile.role === 'coach') {
          router.push('/coach')
        } else if (profile.role === 'parent') {
          if (profile.club_id) {
            const { data: club } = await supabase
              .from('clubs')
              .select('slug')
              .eq('id', profile.club_id)
              .single()
            
            if (club?.slug) {
              router.push(`/clubs/${club.slug}/parent/dashboard`)
            } else {
              router.push('/')
            }
          } else {
            router.push('/')
          }
        } else {
          // Unknown role, redirect to home
          router.push('/')
        }
      }, 1500)
    } catch (err) {
      console.error('Verification error:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get user ID by email (same as verification flow)
      const userResponse = await fetch('/api/auth/get-user-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const userData = await userResponse.json()

      if (!userResponse.ok || !userData.success) {
        setError('No account found for this email address.')
        setLoading(false)
        return
      }

      const fetchedUserId = userData.userId

      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: fetchedUserId,
          type: 'email_verification',
          contact: email,
          metadata: {
            firstName: null,
          }
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to resend code')
        setLoading(false)
        return
      }

      setSuccess('New code sent! Check your email.')
      setOtp('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Resend error:', err)
      setError('Failed to resend code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {attemptsRemaining !== null && (
                  <span className="block mt-1 text-sm">
                    {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-900">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              The email address you registered with
            </p>
          </div>

          <div className="space-y-2">
            <Label>Verification Code</Label>
            <OTPInput
              value={otp}
              onChange={setOtp}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground text-center">
              Enter the 6-digit code and click "Verify Code"
            </p>
          </div>

          <Button
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
            className="w-full"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?
            </p>
            <Button
              variant="link"
              onClick={handleResendCode}
              disabled={loading}
              className="text-sm"
            >
              Resend Code
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <Mail className="h-8 w-8 animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
