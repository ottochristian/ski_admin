'use client'
export const dynamic = 'force-dynamic'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    // Build redirect URL for password reset
    let redirectTo: string
    if (process.env.NEXT_PUBLIC_APP_URL) {
      redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
    } else {
      redirectTo = 'http://localhost:3000/reset-password'
    }

    // Send password reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    // Success - show message
    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  If an account with that email exists, we've sent a password reset link to{' '}
                  <strong>{email}</strong>. Please check your email and click the link to reset your password.
                </AlertDescription>
              </Alert>
              <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email address"
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
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="inline h-3 w-3 mr-1" />
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
