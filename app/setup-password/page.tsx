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
import { AlertCircle, CheckCircle, Key, Mail } from 'lucide-react'

function SetupPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailFromUrl = searchParams.get('email')
  
  // Handle URL decoding issues: spaces should be + signs in emails, lowercase for consistency
  const cleanEmail = emailFromUrl ? emailFromUrl.replace(/\s+/g, '+').toLowerCase() : ''

  const [step, setStep] = useState<'verify' | 'password'>('verify')
  const [email, setEmail] = useState(cleanEmail || '')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (emailFromUrl) {
      // Clean email: replace spaces with +, lowercase for consistency
      const cleaned = emailFromUrl.replace(/\s+/g, '+').toLowerCase()
      console.log('[Setup Password] Email from URL:', emailFromUrl)
      console.log('[Setup Password] Cleaned email:', cleaned)
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
        setError('No invitation found for this email address.')
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
          type: 'admin_invitation',
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

      // OTP verified! Move to password step
      setUserId(user.id)
      setSuccess('Code verified! Now set your password.')
      setTimeout(() => {
        setStep('password')
        setSuccess(null)
      }, 1500)
    } catch (err) {
      console.error('Verification error:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()

    if (!userId) {
      setError('Session expired. Please request a new invitation.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Set password via API route
      const response = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          password
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to set password. Please try again.')
        setLoading(false)
        return
      }

      setSuccess('Password set successfully! Redirecting to login...')
      
      setTimeout(() => {
        router.push('/login?message=Account setup complete! Please log in.')
      }, 2000)
    } catch (err) {
      console.error('Password setup error:', err)
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  async function handleResendCode() {
    console.log('[Resend Code] Email state:', email)
    
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('[Resend Code] Fetching user by email:', email)
      
      // Get user ID by email (same as verification flow)
      const userResponse = await fetch('/api/auth/get-user-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const userData = await userResponse.json()

      if (!userResponse.ok || !userData.success) {
        setError('No invitation found for this email address.')
        setLoading(false)
        return
      }

      const fetchedUserId = userData.userId
      console.log('[Resend Code] Found user ID:', fetchedUserId)

      // Get club info for the email
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, club_id, clubs(name)')
        .eq('id', fetchedUserId)
        .single()

      console.log('[Resend Code] Sending OTP to:', email)
      
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: fetchedUserId,
          type: 'admin_invitation',
          contact: email,
          metadata: {
            firstName: profile?.first_name,
            clubName: (profile?.clubs as any)?.name || 'Ski Admin',
            setupLink: `${window.location.origin}/setup-password?email=${encodeURIComponent(email)}`
          }
        })
      })

      const data = await response.json()
      console.log('[Resend Code] Response:', data)

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to resend code')
        setLoading(false)
        return
      }

      console.log('[Resend Code] SUCCESS! New OTP:', data.code || '(not in dev mode)')
      
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

  if (step === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Key className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Set Your Password</CardTitle>
            <CardDescription className="text-center">
              Create a secure password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email-display">Email</Label>
                <Input
                  id="email-display"
                  type="email"
                  value={email}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 8 characters)"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password *</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || password.length < 8 || password !== confirmPassword}
              >
                {loading ? 'Setting Password...' : 'Set Password & Complete Setup'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Verify Your Invitation</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <span className="block mt-1 text-sm">
                    {attemptsRemaining} attempt(s) remaining
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  disabled={loading || !!emailFromUrl}
                  className={emailFromUrl ? 'bg-gray-50' : ''}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The email address you were invited to
              </p>
            </div>

            <div className="space-y-2">
              <Label>Verification Code</Label>
              <OTPInput
                length={6}
                value={otp}
                onChange={setOtp}
                disabled={loading}
                error={!!error}
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code and click "Verify Code"
              </p>
            </div>

            <Button
              onClick={handleVerifyOTP}
              className="w-full"
              disabled={loading || otp.length !== 6 || !email}
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
                disabled={loading || !email}
                className="text-sm"
              >
                Resend Code
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <SetupPasswordContent />
    </Suspense>
  )
}
