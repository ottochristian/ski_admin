'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Check, Building2 } from 'lucide-react'

const STEPS = ['Your account', 'About you', 'Your club']

export default function NewClubSignupPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [step, setStep] = useState(1)
  const [userId, setUserId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [clubName, setClubName] = useState('')
  const [athleteCount, setAthleteCount] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function goNext() { setError(null); setStep(s => s + 1) }
  function goBack() { setError(null); setStep(s => s - 1) }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/signup/new-club&step=2` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleStep1() {
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
      if (signUpError.message.toLowerCase().includes('already registered') ||
          signUpError.message.toLowerCase().includes('already exists')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setLoading(false)
          router.push(`/login?message=${encodeURIComponent('An account with this email already exists. Please sign in.')}`)
          return
        }
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

  async function handleSubmit() {
    if (!clubName.trim()) return setError('Club name is required.')

    setLoading(true)
    setError(null)

    try {
      const resp = await fetch('/api/club-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone: phone || null, clubName, athleteCountEstimate: athleteCount, notes }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to submit request.')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600/20">
            <Check className="h-7 w-7 text-orange-500" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Request received!</h1>
          <p className="text-sm text-zinc-400 mb-8">
            We'll review your request for <span className="text-foreground font-medium">{clubName}</span> and have everything ready within 24 hours. Check your email for confirmation.
          </p>
          <Link href="/" className="text-sm text-orange-500 hover:text-orange-400">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[360px] flex-shrink-0 bg-zinc-950 flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <Link href="/"><img src="/w110-logo-dark.svg" alt="W110" className="h-5 w-auto" /></Link>
        </div>

        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-600/30 bg-orange-600/10 px-3 py-1 text-xs font-medium text-orange-400">
            <Building2 className="h-3 w-3" />
            New club setup
          </div>
          <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-medium mb-7">Create your club</p>
          <div className="space-y-5">
            {STEPS.map((label, i) => {
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
          <p className="mt-8 text-xs text-zinc-600">We'll review your request and have your club ready within 24 hours.</p>
        </div>

        <p className="text-zinc-700 text-xs">© {new Date().getFullYear()} W110</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-zinc-950 px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile progress bar */}
          <div className="flex gap-1.5 mb-8 lg:hidden">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={`h-1 rounded-full flex-1 transition-colors ${step > i ? 'bg-orange-600' : 'bg-zinc-700'}`} />
            ))}
          </div>

          {step > 1 && (
            <button type="button" onClick={goBack}
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-300 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          {/* Step 1: Account */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
              <p className="mt-1.5 text-sm text-zinc-400">First, set up your admin account.</p>

              <button type="button" onClick={handleGoogleSignIn} disabled={googleLoading}
                className="mt-8 w-full flex items-center justify-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-60 transition-colors">
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
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStep1()}
                    placeholder="you@yourclub.com"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-300">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStep1()}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                </div>
              </div>

              {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

              <button type="button" onClick={handleStep1} disabled={loading}
                className="mt-6 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-orange-500 disabled:opacity-60 transition-colors">
                {loading ? 'Creating account…' : 'Continue'}
              </button>

              <p className="mt-6 text-center text-sm text-zinc-500">
                Already have an account?{' '}
                <Link href="/login" className="text-orange-500 hover:text-orange-400 font-medium">Sign in</Link>
              </p>
              <p className="mt-3 text-center text-sm text-zinc-500">
                Joining an existing club?{' '}
                <Link href="/signup" className="text-orange-500 hover:text-orange-400 font-medium">Sign up here</Link>
              </p>
            </div>
          )}

          {/* Step 2: About you */}
          {step === 2 && (
            <div>
              <h1 className="text-2xl font-bold text-foreground">About you</h1>
              <p className="mt-1.5 text-sm text-zinc-400">Tell us about yourself — you'll be the club admin.</p>

              <div className="mt-8 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-300">First name</label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-300">Last name</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-300">
                    Phone <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                </div>
              </div>

              {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

              <button type="button"
                onClick={() => {
                  if (!firstName.trim() || !lastName.trim()) return setError('First and last name are required.')
                  goNext()
                }}
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-orange-500 disabled:opacity-60 transition-colors">
                Continue
              </button>
            </div>
          )}

          {/* Step 3: Club details */}
          {step === 3 && (
            <div>
              <h1 className="text-2xl font-bold text-foreground">Your club</h1>
              <p className="mt-1.5 text-sm text-zinc-400">Tell us about your club. We'll have it ready within 24 hours.</p>

              <div className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-300">Club name</label>
                  <input type="text" value={clubName} onChange={e => setClubName(e.target.value)}
                    placeholder="e.g. Jackson Hole Ski Club"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-300">
                    Approximate athlete count <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <select value={athleteCount} onChange={e => setAthleteCount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow">
                    <option value="">Select a range…</option>
                    <option value="1-25">1–25 athletes</option>
                    <option value="26-75">26–75 athletes</option>
                    <option value="76-150">76–150 athletes</option>
                    <option value="150+">150+ athletes</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-300">
                    Anything else we should know? <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. we run alpine and freestyle programs, currently using spreadsheets…"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow resize-none" />
                </div>
              </div>

              {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

              <button type="button" onClick={handleSubmit} disabled={loading}
                className="mt-6 w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-orange-500 disabled:opacity-60 transition-colors">
                {loading ? 'Submitting…' : 'Submit request'}
              </button>

              <p className="mt-4 text-xs text-zinc-600 text-center">
                We'll review your request and email you when your club is ready.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
