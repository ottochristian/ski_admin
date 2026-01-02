'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OTPInput } from '@/components/ui/otp-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, Key, Loader2 } from 'lucide-react'

interface TokenUser {
  id: string
  email: string
  type: string
  clubId?: string
  role: string
}

function SetupPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenFromUrl = searchParams.get('token')

  // State
  const [validatingToken, setValidatingToken] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [user, setUser] = useState<TokenUser | null>(null)
  
  const [step, setStep] = useState<'verify' | 'password'>('verify')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  // Validate token on mount
  useEffect(() => {
    async function validateSetupToken() {
      if (!tokenFromUrl) {
        setTokenError('No setup token provided. Please use the link from your invitation email.')
        setValidatingToken(false)
        setTokenValid(false)
        return
      }

      try {
        const response = await fetch('/api/auth/verify-setup-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenFromUrl })
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          setTokenError(data.error || 'Invalid or expired setup link')
          setTokenValid(false)
          setValidatingToken(false)
          return
        }

        // Token is valid
        setUser(data.user)
        setTokenValid(true)
        setValidatingToken(false)
      } catch (err) {
        console.error('Token validation error:', err)
        setTokenError('Failed to validate setup link. Please try again.')
        setTokenValid(false)
        setValidatingToken(false)
      }
    }

    validateSetupToken()
  }, [tokenFromUrl])

  async function handleVerifyOTP() {
    if (!user || !otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    if (loading) return

    setLoading(true)
    setError(null)

    try {
      // Verify OTP via API
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          code: otp,
          type: 'admin_invitation',
          contact: user.email
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

    if (!user) {
      setError('Session expired. Please request a new invitation.')
      return
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Set password via API
      const response = await fetch('/api/auth/setup-password-secure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          password,
          token: tokenFromUrl // Include token to mark as used
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
    if (!user) {
      setError('Session expired')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: 'admin_invitation',
          contact: user.email,
          metadata: {
            firstName: null,
            clubName: 'Ski Admin',
            setupLink: `${window.location.origin}/setup-password?token=${tokenFromUrl}`
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

  // Show loading while validating token
  if (validatingToken) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating setup link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error if token is invalid
  if (!tokenValid || tokenError) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Setup Link</CardTitle>
            <CardDescription>
              {tokenError || 'This setup link is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This could happen if:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>The link has expired (valid for 48 hours)</li>
                <li>The link has already been used</li>
                <li>The link is malformed or incomplete</li>
                <li>Your account setup is already complete</li>
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => router.push('/login')}
                variant="outline"
              >
                Go to Login
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Need a new invitation? Contact your system administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show OTP verification step
  if (step === 'verify') {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Verify Your Invitation</CardTitle>
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
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                The email address you were invited to
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

  // Show password setup step
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
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
              <Alert className="border-green-200 bg-green-50 text-green-900">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                Minimum 12 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full"
            >
              {loading ? 'Setting Password...' : 'Set Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SetupPasswordContent />
    </Suspense>
  )
}
