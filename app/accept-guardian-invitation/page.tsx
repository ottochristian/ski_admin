'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAcceptGuardianInvitation } from '@/lib/hooks/use-household-guardians'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, LogIn } from 'lucide-react'

function AcceptGuardianInvitationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [hasAccepted, setHasAccepted] = useState(false)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clubId, setClubId] = useState<string | null>(null)
  const [invitationEmail, setInvitationEmail] = useState<string | null>(null)

  const { mutate: acceptInvitation, isPending, isError, error } = useAcceptGuardianInvitation()

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        setIsAuthenticated(!!user)
      } catch {
        setIsAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    async function fetchInvitationInfo() {
      if (!token || isAuthenticated || isCheckingAuth) return
      try {
        const response = await fetch(`/api/household-guardians/invitation-info?token=${token}`)
        if (response.ok) {
          const data = await response.json()
          if (data.clubId) setClubId(data.clubId)
          if (data.email) setInvitationEmail(data.email)
        }
      } catch {}
    }
    fetchInvitationInfo()
  }, [token, isAuthenticated, isCheckingAuth])

  useEffect(() => {
    if (!token || !isAuthenticated || isCheckingAuth) return

    acceptInvitation(token, {
      onSuccess: (data) => {
        setHasAccepted(true)
        const safeTarget = data.redirectTo?.startsWith('/clubs/') || data.redirectTo?.startsWith('/parent/')
          ? data.redirectTo
          : null
        if (safeTarget) {
          setRedirectTo(safeTarget)
          toast.success('Invitation accepted!', { description: data.message || 'You are now a guardian for this household.' })
          setTimeout(() => router.push(safeTarget), 2000)
        }
      },
      onError: () => {},
    })
  }, [token, isAuthenticated, isCheckingAuth, acceptInvitation, router])

  const layout = (children: React.ReactNode) => (
    <div className="min-h-screen flex bg-background relative">
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/topo-bg.svg" alt="" className="w-full h-full object-cover opacity-[0.055]" />
      </div>
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-zinc-800 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-end justify-start">
          <div className="h-[400px] w-[400px] rounded-full bg-orange-600/10 blur-[100px] -translate-x-1/4 translate-y-1/4" />
        </div>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/w110-logo-dark.svg" alt="W110" className="h-8 w-auto" /></Link>
        </div>
        <div className="relative">
          <p className="text-3xl font-bold text-foreground leading-snug tracking-tight">
            Run your club.<br />
            <span className="text-orange-500">Not spreadsheets.</span>
          </p>
          <p className="mt-4 text-zinc-500 text-sm leading-relaxed max-w-xs">
            Registrations, athlete management, waivers, payments, and AI-powered coaching tools — built for the way clubs actually operate.
          </p>
        </div>
        <p className="relative text-zinc-700 text-xs">© {new Date().getFullYear()} West 110</p>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/w110-logo-dark.svg" alt="W110" className="h-8 w-auto" /></Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )

  if (isCheckingAuth) {
    return layout(
      <div className="flex items-center gap-2 text-zinc-500 text-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        Checking authentication…
      </div>
    )
  }

  if (!token) {
    return layout(
      <>
        <h1 className="page-title text-foreground">Invalid invitation</h1>
        <p className="mt-1.5 text-sm text-zinc-500">No invitation token provided. Please use the link from your invitation email.</p>
        <Link href="/login" className="mt-8 block w-full rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-sm font-semibold text-foreground text-center transition-colors">
          Go to sign in
        </Link>
      </>
    )
  }

  if (!isAuthenticated) {
    const redirectPath = `/accept-guardian-invitation?token=${token}`
    const loginUrl = `/login?redirect=${encodeURIComponent(redirectPath)}`
    const signupParams = new URLSearchParams()
    signupParams.set('redirect', redirectPath)
    if (clubId) signupParams.set('clubId', clubId)
    if (invitationEmail) signupParams.set('email', invitationEmail)
    const signupUrl = `/signup?${signupParams.toString()}`

    return layout(
      <>
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-orange-600/10">
          <LogIn className="h-6 w-6 text-orange-500" />
        </div>
        <h1 className="page-title text-foreground">Sign in required</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          You need to be logged in to accept this guardian invitation. After signing in, you&apos;ll be redirected back here.
        </p>
        <div className="mt-8 space-y-3">
          <Link href={loginUrl} className="block w-full rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-sm font-semibold text-foreground text-center transition-colors">
            Sign in
          </Link>
          <Link href={signupUrl} className="block w-full rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-foreground px-4 py-2.5 text-sm font-medium text-center transition-colors">
            Create account
          </Link>
        </div>
      </>
    )
  }

  if (hasAccepted && redirectTo) {
    return layout(
      <>
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-green-900/30">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
        </div>
        <h1 className="page-title text-foreground">Invitation accepted!</h1>
        <p className="mt-1.5 text-sm text-zinc-500">You are now a guardian for this household. Redirecting you…</p>
        <Link href={redirectTo} className="mt-8 block w-full rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-sm font-semibold text-foreground text-center transition-colors">
          Go to dashboard
        </Link>
      </>
    )
  }

  if (isPending) {
    return layout(
      <div className="flex items-center gap-2 text-zinc-500 text-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        Accepting invitation…
      </div>
    )
  }

  if (isError) {
    return layout(
      <>
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/30">
          <XCircle className="h-6 w-6 text-red-400" />
        </div>
        <h1 className="page-title text-foreground">Invitation failed</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          {error instanceof Error ? error.message : 'Failed to accept invitation'}
        </p>
        <ul className="mt-4 space-y-1 text-sm text-zinc-600 list-disc pl-4">
          <li>The invitation token has expired</li>
          <li>You are already a guardian in another household</li>
          <li>The household has reached its guardian limit</li>
          <li>The invitation was cancelled</li>
        </ul>
        <div className="mt-8 flex gap-3">
          <Link href="/login" className="flex-1 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-foreground px-4 py-2.5 text-sm font-medium text-center transition-colors">
            Sign in
          </Link>
          <button
            onClick={() => acceptInvitation(token)}
            className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      </>
    )
  }

  return null
}

export default function AcceptGuardianInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    }>
      <AcceptGuardianInvitationContent />
    </Suspense>
  )
}
