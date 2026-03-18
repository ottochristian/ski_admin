'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Check } from 'lucide-react'
import { ClubPicker } from '@/components/club-picker'

type Club = { id: string; name: string; slug: string }

const STEPS = ['Your account', 'About you', 'Your club']

export default function SignupPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [step, setStep] = useState(1)
  const [userId, setUserId] = useState<string | null>(null)

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedClubId, setSelectedClubId] = useState('')

  // Invitation params
  const [invitedClubId, setInvitedClubId] = useState<string | null>(null)
  const [isInvitation, setIsInvitation] = useState(false)

  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // ── On mount: parse invite params + check for partial session ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const clubId = params.get('clubId')
    const emailParam = params.get('email')
    const redirect = params.get('redirect')
    const invitation = !!(clubId || redirect?.includes('accept-guardian-invitation'))

    if (invitation) {
      setIsInvitation(true)
      if (clubId) { setInvitedClubId(clubId); setSelectedClubId(clubId) }
      if (emailParam) setEmail(emailParam)
    }

    // Check if user already started signup (has session but no complete profile)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setCheckingSession(false); return }

      // Has a session — check what's complete
      const [{ data: profile }, { data: householdGuardian }] = await Promise.all([
        supabase.from('profiles').select('first_name, last_name, club_id').eq('id', user.id).maybeSingle(),
        supabase.from('household_guardians').select('household_id').eq('user_id', user.id).maybeSingle(),
      ])

      // Household exists = onboarding is truly done
      if (householdGuardian) {
        router.replace('/login')
        return
      }

      // No profile yet (shouldn't happen after trigger fix, but handle it)
      if (!profile) {
        setUserId(user.id)
        setEmail(user.email ?? '')
        const meta = user.user_metadata ?? {}
        if (meta.first_name) setFirstName(meta.first_name)
        if (meta.last_name) setLastName(meta.last_name)
        setStep(2)
        setCheckingSession(false)
        return
      }

      const nameComplete = profile.first_name?.trim() !== '' && profile.last_name?.trim() !== ''

      setUserId(user.id)
      setEmail(user.email ?? '')

      if (!nameComplete) {
        // Trigger created a stub with empty name — resume at step 2
        setStep(2)
      } else {
        // Name done but no household yet — resume at step 3 (club → creates household)
        setFirstName(profile.first_name)
        setLastName(profile.last_name)
        setStep(invitation ? 2 : 3)
      }

      setCheckingSession(false)
    })
  }, [supabase, router])

  // Load clubs
  useEffect(() => {
    fetch('/api/clubs/public')
      .then(r => r.json())
      .then(j => setClubs(j?.clubs ?? []))
      .catch(console.error)
  }, [])

  const totalSteps = isInvitation ? 2 : 3

  function goNext() { setError(null); setStep(s => s + 1) }
  function goBack() { setError(null); setStep(s => s - 1) }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  // ── Step 1: create the auth user immediately ──
  async function handleStep1Continue() {
    if (!email) return setError('Email is required.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')

    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: '', last_name: '' } },
    })

    if (signUpError) {
      // If already registered, try signing them in — they may have dropped off mid-flow
      if (signUpError.message.toLowerCase().includes('already registered') ||
          signUpError.message.toLowerCase().includes('already exists')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          // Wrong password or other sign-in issue — send them to login
          setLoading(false)
          router.push(`/login?message=${encodeURIComponent('An account with this email already exists. Please sign in.')}`)
          return
        }
        // Signed in — they were mid-onboarding. The mount effect will resume them,
        // but we can fast-path here since we have the user.
        setUserId(signInData.user.id)
        setLoading(false)
        goNext()
        return
      }
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Could not create account. Please try again.')
      setLoading(false)
      return
    }

    setUserId(data.user.id)
    setLoading(false)
    goNext()
  }

  // ── Final submit (called from step 2 for invitations, step 3 for regular) ──
  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const uid = userId
    if (!uid) { setError('Session lost — please start again.'); setLoading(false); return }

    const clubId = invitedClubId ?? selectedClubId

    try {
      // Update profile directly with real name and club
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone || null,
          club_id: clubId,
        })
        .eq('id', uid)

      if (profileUpdateError) {
        throw new Error('Failed to save profile. Please try again.')
      }

      // OAuth users (Google etc.) — email already verified, create household directly
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const isOAuth = currentUser?.app_metadata?.provider !== 'email'

      if (isOAuth) {
        const resp = await fetch('/api/auth/complete-google-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName, lastName, phone: phone || null, clubId }),
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error || 'Failed to complete signup.')
        router.push(data.clubSlug ? `/clubs/${data.clubSlug}/parent/dashboard` : '/login')
        return
      }

      // Invitation → complete directly (no OTP)
      if (isInvitation) {
        const redirect = new URLSearchParams(window.location.search).get('redirect')
        const resp = await fetch('/api/auth/complete-invitation-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: uid,
            email: email.toLowerCase(),
            firstName, lastName,
            phone: phone || null,
            addressLine1: null, addressLine2: null,
            city: null, state: null, zipCode: null,
            emergencyContactName: null, emergencyContactPhone: null,
            clubId,
          }),
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error || 'Failed to complete signup.')
        router.push(redirect || '/login?message=Account created! Please log in.')
        return
      }

      // Regular → send OTP verification
      const clubName = clubs.find(c => c.id === clubId)?.name ?? 'Ski Club'
      const otpResp = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          type: 'email_verification',
          contact: email.toLowerCase(),
          metadata: { firstName, clubName },
        }),
      })
      const otpData = await otpResp.json()
      if (!otpResp.ok || !otpData.success) throw new Error('Account created but failed to send verification email. Please contact support.')

      router.push(`/verify-email?email=${encodeURIComponent(email.toLowerCase())}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <p className="text-zinc-500 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[360px] flex-shrink-0 bg-zinc-950 flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <img src="/w110-logo-dark.svg" alt="W110" className="h-5 w-auto" />
        </div>

        <div>
          <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-medium mb-7">Create your account</p>
          <div className="space-y-5">
            {STEPS.slice(0, totalSteps).map((label, i) => {
              const n = i + 1
              const done = step > n
              const active = step === n
              return (
                <div key={n} className="flex items-center gap-3.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold transition-colors
                    ${done ? 'bg-orange-600 text-foreground' : active ? 'bg-foreground text-background' : 'bg-zinc-800 text-zinc-500'}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : n}
                  </div>
                  <span className={`text-sm transition-colors ${active ? 'text-foreground font-medium' : done ? 'text-zinc-500' : 'text-zinc-600'}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-zinc-700 text-xs">© {new Date().getFullYear()} W110</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center bg-zinc-950 px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center flex-shrink-0">
              <span className="text-foreground text-xs font-bold leading-none">S</span>
            </div>
            <span className="text-foreground text-sm font-semibold tracking-tight">Ski Admin</span>
          </div>

          {/* Mobile progress bar */}
          <div className="flex gap-1.5 mb-8 lg:hidden">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className={`h-1 rounded-full flex-1 transition-colors ${step > i ? 'bg-orange-600' : 'bg-zinc-700'}`} />
            ))}
          </div>

          {/* Back — only show on step 2 when they came from step 1 (not resumed) */}
          {step > 1 && !userId && (
            <button type="button" onClick={goBack}
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          {/* ══════════════ STEP 1: Account ══════════════ */}
          {step === 1 && (
            <div>
              <h1 className="page-title text-foreground">Create your account</h1>
              <p className="mt-1.5 text-sm text-zinc-400">
                {isInvitation ? "You've been invited — set up your account to continue." : 'Get started with W110.'}
              </p>

              <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading}
                className="mt-8 w-full flex items-center justify-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-60 transition-colors shadow-sm">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                  <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58Z"/>
                </svg>
                {googleLoading ? 'Redirecting…' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-500">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-300">Email</label>
                  <input type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStep1Continue()}
                    disabled={isInvitation && !!email}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-zinc-800 disabled:text-zinc-500 transition-shadow" />
                  {isInvitation && <p className="text-xs text-zinc-400">Pre-filled from your invitation.</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-300">Password</label>
                  <input type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStep1Continue()}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                </div>
              </div>

              {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <button type="button" onClick={handleStep1Continue} disabled={loading}
                className="mt-6 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-60 transition-colors">
                {loading ? 'Creating account…' : 'Continue'}
              </button>

              <p className="mt-6 text-center text-sm text-zinc-400">
                Already have an account?{' '}
                <Link href="/login" className="text-orange-500 hover:text-orange-400 font-medium">Sign in</Link>
              </p>
            </div>
          )}

          {/* ══════════════ STEP 2: About you ══════════════ */}
          {step === 2 && (
            <div>
              <h1 className="page-title text-foreground">About you</h1>
              <p className="mt-1.5 text-sm text-zinc-400">
                {userId ? `Welcome back! Just a couple more details to finish up.` : 'A couple of details to set up your profile.'}
              </p>

              <div className="mt-8 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-300">First name</label>
                    <input type="text" value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-300">Last name</label>
                    <input type="text" value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-300">
                    Phone <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <input type="tel" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                </div>
              </div>

              {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <button type="button"
                onClick={() => {
                  if (!firstName.trim() || !lastName.trim()) return setError('First and last name are required.')
                  isInvitation ? handleSubmit() : goNext()
                }}
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-60 transition-colors">
                {loading ? 'Saving…' : isInvitation ? 'Create account' : 'Continue'}
              </button>
            </div>
          )}

          {/* ══════════════ STEP 3: Club ══════════════ */}
          {step === 3 && (
            <div>
              <h1 className="page-title text-foreground">Your club</h1>
              <p className="mt-1.5 text-sm text-zinc-400">Search for the club you're registering with.</p>

              <div className="mt-8">
                {clubs.length === 0
                  ? <p className="text-sm text-zinc-400">Loading clubs…</p>
                  : <ClubPicker clubs={clubs} value={selectedClubId} onChange={setSelectedClubId} />
                }
              </div>

              {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <button type="button"
                onClick={() => {
                  if (!selectedClubId) return setError('Please select a club to continue.')
                  handleSubmit()
                }}
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-60 transition-colors">
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
