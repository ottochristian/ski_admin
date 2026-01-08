'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useClub } from '@/lib/club-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function SignupPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const { club } = useClub()
  
  // Check if signup is coming from invitation (has redirect to accept-guardian-invitation)
  const [isInvitationSignup, setIsInvitationSignup] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const redirect = urlParams.get('redirect')
      if (redirect && redirect.includes('accept-guardian-invitation')) {
        setIsInvitationSignup(true)
      }
    }
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const [clubs, setClubs] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [loading, setLoading] = useState(false)
  const [loadingClubs, setLoadingClubs] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Initialize showClubSelection based on URL params to avoid race condition
  const [clubFromInvitation, setClubFromInvitation] = useState<string | null>(null)
  const [emailFromInvitation, setEmailFromInvitation] = useState<string | null>(null)
  // Initialize to true, will be updated in useEffect to avoid hydration mismatch
  const [showClubSelection, setShowClubSelection] = useState(true)

  // Check for club_id and email from invitation in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const clubIdParam = urlParams.get('clubId')
      const emailParam = urlParams.get('email')
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:56',message:'Checking URL for clubId and email params',data:{clubIdParam,emailParam,hasClubId:!!clubIdParam,hasEmail:!!emailParam},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (clubIdParam) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:60',message:'Setting clubFromInvitation and hiding club selection',data:{clubIdParam},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        setClubFromInvitation(clubIdParam)
        setShowClubSelection(false) // Hide club selection when coming from invitation
      }
      
      if (emailParam) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:70',message:'Setting email from invitation',data:{emailParam},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        setEmailFromInvitation(emailParam)
        setEmail(emailParam) // Pre-fill email field
      }
    }
  }, [])

  // Load available clubs
  useEffect(() => {
    async function loadClubs() {
      try {
        // Check URL params directly to avoid race conditions
        let urlClubId: string | null = null
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          urlClubId = urlParams.get('clubId')
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:90',message:'loadClubs effect running',data:{clubFromInvitation,urlClubId,clubId:club?.id,showClubSelection},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        const { data, error: clubsError } = await supabase
          .from('clubs')
          .select('id, name, slug')
          .order('name', { ascending: true })

        if (clubsError) {
          console.error('Error loading clubs:', clubsError)
        } else {
          setClubs(data || [])
          
          // Use URL clubId if available (most reliable), otherwise use state
          const effectiveClubId = urlClubId || clubFromInvitation
          
          // Priority: club from invitation (URL) > club from context > first club
          if (effectiveClubId) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:107',message:'Processing invitation club',data:{effectiveClubId,clubsCount:data?.length,loadingClubs},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            // CRITICAL: If we have a clubId from URL, ALWAYS hide club selection for invitations
            // Don't wait for clubs to load - the URL param is authoritative
            if (urlClubId) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:113',message:'URL has clubId - hiding club selection immediately',data:{urlClubId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              
              setSelectedClubId(effectiveClubId)
              setShowClubSelection(false) // Always hide for invitations
              
              // Also update clubFromInvitation state if we got it from URL
              if (!clubFromInvitation) {
                setClubFromInvitation(urlClubId)
              }
            } else {
              // Only verify club exists if we don't have URL param (using state)
              const invitedClub = data?.find(c => c.id === effectiveClubId)
              if (invitedClub) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:125',message:'Invited club found, setting selectedClubId and keeping showClubSelection false',data:{clubId:effectiveClubId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                
                setSelectedClubId(effectiveClubId)
                setShowClubSelection(false)
              } else if (data && data.length > 0) {
                // Clubs loaded but club not found - fallback
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:133',message:'Invited club NOT found after clubs loaded, showing club selection as fallback',data:{effectiveClubId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                
                setShowClubSelection(true)
                setSelectedClubId(data[0].id)
              }
              // If clubs haven't loaded yet (data is empty), don't change showClubSelection
              // It should already be set to false by the URL check
            }
          } else {
            // No invitation club - check if this is actually a regular signup
            // Double-check URL params to be absolutely sure
            let isActuallyInvitation = false
            if (typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search)
              const urlClubIdCheck = urlParams.get('clubId')
              const redirectParam = urlParams.get('redirect')
              isActuallyInvitation = !!(urlClubIdCheck || (redirectParam && redirectParam.includes('accept-guardian-invitation')))
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:157',message:'No invitation club in state, checking URL',data:{clubId:club?.id,isActuallyInvitation,currentShowClubSelection:showClubSelection},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            // Only proceed with regular signup logic if NOT an invitation
            if (!isActuallyInvitation) {
              if (club?.id) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:165',message:'Using club from context',data:{clubId:club.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                
                setSelectedClubId(club.id)
                setShowClubSelection(true) // Show selection for regular signups
              } else if (data && data.length > 0) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:171',message:'Using first club as default',data:{firstClubId:data[0].id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                
                // Default to first club if no club in context
                setSelectedClubId(data[0].id)
                setShowClubSelection(true) // Show selection for regular signups
              }
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:179',message:'Detected invitation from URL, keeping club selection hidden',data:{urlClubIdCheck},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              
              // This is an invitation - keep club selection hidden
              setShowClubSelection(false)
            }
          }
        }
      } catch (err) {
        console.error('Error loading clubs:', err)
      } finally {
        setLoadingClubs(false)
      }
    }

    loadClubs()
  }, [club, clubFromInvitation])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Sign up the user (try without metadata first to isolate the issue)
      let authData, signUpError
      
      try {
        // Add timeout wrapper for signUp call
        // NOTE: We do NOT set emailRedirectTo here because we use our custom OTP verification
        // system instead of Supabase's native email confirmation
        const signUpPromise = supabase.auth.signUp({
          email,
          password,
          options: {
            // Do NOT add emailRedirectTo - it triggers Supabase native emails
            // Our OTP system handles verification instead
            data: {
              first_name: firstName || '',
              last_name: lastName || '',
            },
          },
        })
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Signup timeout')), 10000)
        )
        
        const result = await Promise.race([signUpPromise, timeoutPromise]) as any
        authData = result.data
        signUpError = result.error
      } catch (err: any) {
        console.error('Signup exception:', err)
        if (err.message === 'Signup timeout') {
          setError('Signup is taking longer than expected. Please check your internet connection and try again.')
        } else {
          setError(`Signup failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
        setLoading(false)
        return
      }

      if (signUpError) {
        console.error('Signup error details:', signUpError)
        // Handle specific error cases
        if (
          signUpError.message.includes('already registered') ||
          signUpError.message.includes('already exists') ||
          signUpError.message.includes('User already registered')
        ) {
          setError('An account with this email already exists. Please log in instead, or check your email for a confirmation link.')
          setLoading(false)
          setTimeout(() => {
            router.push('/login?message=Account already exists. Please log in or check your email for a confirmation link.')
          }, 2000)
          return
        } else {
          // Show the actual error message with full details
          setError(`Signup failed: ${signUpError.message}. Check console for details.`)
          console.error('Full signup error:', JSON.stringify(signUpError, null, 2))
        }
        setLoading(false)
        return
      }

      // Check if this is a repeated signup (user already exists)
      // Supabase returns success but no user if email already exists and confirmation is pending
      if (!authData.user) {
        // User already exists - redirect to login
        setError('An account with this email already exists. Redirecting to login...')
        setLoading(false)
        setTimeout(() => {
          router.push('/login?message=Account already exists. Please log in or check your email for a confirmation link.')
        }, 2000)
        return
      }

      // 2. Get club ID (priority: invitation > selection > context > default)
      let clubId = clubFromInvitation || selectedClubId || club?.id
      if (!clubId) {
        const { data: defaultClub } = await supabase
          .from('clubs')
          .select('id')
          .eq('slug', 'default')
          .single()
        clubId = defaultClub?.id || null
      }

      if (!clubId) {
        // Only show error for regular signups, not invitation signups
        if (!clubFromInvitation) {
          setError('Please select a club to register with.')
        } else {
          setError('Invalid invitation. Please contact support.')
        }
        setLoading(false)
        return
      }

      // Store signup form data in temporary table (avoids metadata size limits)
      // This data will be used when user confirms email and logs in
      // Use a function that bypasses RLS (works even without session)
      try {
        const { error: signupDataError } = await supabase.rpc('store_signup_data', {
          p_user_id: authData.user.id,
          p_email: email,
          p_first_name: firstName,
          p_last_name: lastName,
          p_phone: phone || null,
          p_address_line1: addressLine1 || null,
          p_address_line2: addressLine2 || null,
          p_city: city || null,
          p_state: state || null,
          p_zip_code: zipCode || null,
          p_emergency_contact_name: emergencyContactName || null,
          p_emergency_contact_phone: emergencyContactPhone || null,
          p_club_id: clubId,
        })

        // If function doesn't exist or fails, that's OK - we'll use metadata fallback
        if (signupDataError) {
          console.warn('Could not store signup data (function may not exist):', signupDataError.message)
          // Don't fail the signup - we can still use metadata
        }
      } catch (err) {
        // Function might not exist - that's fine, continue with signup
        console.warn('store_signup_data function may not exist:', err)
      }

      // Check if this is an invitation signup (skip email verification)
      if (isInvitationSignup) {
        console.log('[SIGNUP] Invitation signup detected - skipping email verification')
        
        // Complete signup directly (confirm email, create profile, create household)
        try {
          const completeResponse = await fetch('/api/auth/complete-invitation-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: authData.user.id,
              email: email.toLowerCase(),
              firstName: firstName || null,
              lastName: lastName || null,
              phone: phone || null,
              addressLine1: addressLine1 || null,
              addressLine2: addressLine2 || null,
              city: city || null,
              state: state || null,
              zipCode: zipCode || null,
              emergencyContactName: emergencyContactName || null,
              emergencyContactPhone: emergencyContactPhone || null,
              clubId: clubId,
            })
          })

          const completeData = await completeResponse.json()

          if (!completeResponse.ok || !completeData.success) {
            console.error('Failed to complete invitation signup:', completeData.error)
            setError(completeData.error || 'Failed to complete account setup. Please contact support.')
            setLoading(false)
            return
          }

          console.log('[SIGNUP] Invitation signup completed - redirecting to accept invitation')
          
          // Get redirect URL from query params
          const urlParams = new URLSearchParams(window.location.search)
          const redirectTo = urlParams.get('redirect')
          
          if (redirectTo) {
            router.push(redirectTo)
          } else {
            router.push('/login?message=Account created! Please log in.')
          }
        } catch (err) {
          console.error('Error completing invitation signup:', err)
          setError('Failed to complete account setup. Please contact support.')
        }
        
        setLoading(false)
        return
      }

      // Regular signup flow - send OTP for verification
      // ALWAYS send OTP for verification (regardless of Supabase confirmation settings)
      // This gives us full control over the verification flow
      console.log('[SIGNUP] Regular signup - sending OTP verification email...')
      {
        // Send OTP verification email
        try {
          const otpResponse = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: authData.user.id,
              type: 'email_verification',
              contact: email.toLowerCase(),
              metadata: {
                firstName: firstName,
                clubName: clubs.find(c => c.id === clubId)?.name || 'Ski Club'
              }
            })
          })

          const otpData = await otpResponse.json()
          console.log('[SIGNUP] OTP send result:', { ok: otpResponse.ok, success: otpData.success })

          if (!otpResponse.ok || !otpData.success) {
            console.error('Failed to send verification email:', otpData.error)
            setError('Account created but failed to send verification email. Please contact support.')
            setLoading(false)
            return
          }

          console.log('[SIGNUP] Redirecting to verify-email page')
          // Success! Redirect to email verification page
          router.push(`/verify-email?email=${encodeURIComponent(email.toLowerCase())}`)
        } catch (err) {
          console.error('Error sending verification email:', err)
          setError('Account created but failed to send verification email. Please contact support.')
        }
        
        setLoading(false)
        return
      }

      // ========================================================================
      // NOTE: The code below (lines 240-350) is LEGACY and will be removed
      // after Supabase email confirmations are disabled.
      //
      // NEW FLOW (Option A):
      // 1. Signup → Store in signup_data → Send OTP
      // 2. Verify OTP → Create profile + household
      // 3. Login → Access portal
      //
      // This block will be deleted after testing confirms the new flow works.
      // ========================================================================
      /*
      // Session exists - email confirmation is disabled, proceed with profile creation immediately
      // Wait a moment for user to be committed to auth.users
      await new Promise(resolve => setTimeout(resolve, 1000))

      if (!clubId) {
        setError('No club found. Please contact support.')
        setLoading(false)
        return
      }

      // 3. Create profile with parent role using database function (bypasses RLS)
      const { error: profileError } = await supabase.rpc('create_user_profile', {
        p_user_id: authData.user.id,
        p_email: email,
        p_first_name: firstName,
        p_last_name: lastName,
        p_role: 'parent',
        p_club_id: clubId,
      })

      if (profileError) {
        // If profile creation fails, log it but continue
        // Profile will be created on first login if it doesn't exist
        console.warn('Profile creation warning:', profileError.message)
      }

      // 4. Create household (or family as fallback) with full details
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .insert([
          {
            club_id: clubId,
            primary_email: email,
            phone: phone || null,
            address_line1: addressLine1 || null,
            address_line2: addressLine2 || null,
            city: city || null,
            state: state || null,
            zip_code: zipCode || null,
            emergency_contact_name: emergencyContactName || null,
            emergency_contact_phone: emergencyContactPhone || null,
          },
        ])
        .select()
        .single()

      if (householdError) {
        setError(`Failed to create household: ${householdError.message}`)
        setLoading(false)
        return
      }

      // 5. Link user to household via household_guardians
      const { error: guardianError } = await supabase
        .from('household_guardians')
        .insert([
          {
            household_id: householdData.id,
            user_id: authData.user.id,
            is_primary: true,
          },
        ])

      if (guardianError) {
        console.error('Error creating household guardian:', guardianError)
        // Not fatal - continue
      }

      // 6. Redirect based on whether session exists
      if (authData.session) {
        // User is logged in immediately (email confirmation disabled)
        const clubSlug = club?.slug || 'default'
        router.push(`/clubs/${clubSlug}/parent/dashboard`)
      } else {
        // Email confirmation might be required (but emails might not be configured)
        // Redirect to login - profile will be created when they log in
        router.push('/login?message=Account created! You can now log in.')
      }
      */
      // END LEGACY CODE - TO BE REMOVED
    } catch (err) {
      console.error('Signup error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <h1 className="mb-4 text-xl font-semibold text-slate-100">
          Create Parent Account & Household
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          Create your account and set up your household information
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Only show club selection for regular signups, not invitation signups */}
          {/* Check URL params directly during render to avoid state race conditions */}
          {(() => {
            // Check URL params directly - most reliable way to determine if this is an invitation
            let isInvitationFromUrl = false
            let urlClubIdCheck: string | null = null
            if (typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search)
              urlClubIdCheck = urlParams.get('clubId')
              const redirectParam = urlParams.get('redirect')
              // Check for both clubId param OR redirect to accept-guardian-invitation
              isInvitationFromUrl = !!(urlClubIdCheck || (redirectParam && redirectParam.includes('accept-guardian-invitation')))
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/signup/page.tsx:450',message:'Rendering club selection check',data:{showClubSelection,clubFromInvitation,urlClubIdCheck,isInvitationFromUrl,isInvitationSignup},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            // CRITICAL: If URL has clubId or redirect to invitation, NEVER show club selection
            // This check happens during render, so it's always accurate
            const shouldShowClubSelection = !isInvitationFromUrl && showClubSelection
            
            return shouldShowClubSelection ? (
              <div className="space-y-4 border-b border-slate-700 pb-4">
                <h2 className="text-sm font-semibold text-slate-200">Club Selection</h2>
                
                {loadingClubs ? (
                  <p className="text-sm text-slate-400">Loading clubs...</p>
                ) : (
                  <div>
                    <Label htmlFor="club" className="text-slate-300">
                      Select Club *
                    </Label>
                    <Select
                      value={selectedClubId}
                      onValueChange={setSelectedClubId}
                      required
                    >
                      <SelectTrigger className="mt-1 bg-slate-800 text-slate-100 border-slate-700">
                        <SelectValue placeholder="Select a club" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {clubs.map(clubOption => (
                          <SelectItem 
                            key={clubOption.id} 
                            value={clubOption.id}
                            className="text-slate-100 focus:bg-slate-700 focus:text-slate-50"
                          >
                            {clubOption.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ) : null
          })()}
          
          {/* Legacy code - keeping for reference but should not render */}
          {false && showClubSelection && (
            <div className="space-y-4 border-b border-slate-700 pb-4">
              <h2 className="text-sm font-semibold text-slate-200">Club Selection</h2>
              
              {loadingClubs ? (
                <p className="text-sm text-slate-400">Loading clubs...</p>
              ) : (
                <div>
                  <Label htmlFor="club" className="text-slate-300">
                    Select Club *
                  </Label>
                  <Select
                    value={selectedClubId}
                    onValueChange={setSelectedClubId}
                    required
                  >
                    <SelectTrigger className="mt-1 bg-slate-800 text-slate-100 border-slate-700">
                      <SelectValue placeholder="Select a club" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {clubs.map(clubOption => (
                        <SelectItem 
                          key={clubOption.id} 
                          value={clubOption.id}
                          className="text-slate-100 focus:bg-slate-700 focus:text-slate-50"
                        >
                          {clubOption.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          
          {/* Club info is hidden for invitation signups - set automatically in background */}

          <div className="space-y-4 border-b border-slate-700 pb-4">
            <h2 className="text-sm font-semibold text-slate-200">Account Information</h2>
            
            <div>
              <Label htmlFor="firstName" className="text-slate-300">
                First Name
              </Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
              />
            </div>

            <div>
              <Label htmlFor="lastName" className="text-slate-300">
                Last Name
              </Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
              />
            </div>

            {/* Hide email field for invitation signups - we already have it */}
            {!emailFromInvitation && (
              <div>
                <Label htmlFor="email" className="text-slate-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
                />
              </div>
            )}
            {/* Show read-only email for invitation signups */}
            {emailFromInvitation && (
              <div>
                <Label htmlFor="email" className="text-slate-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="mt-1 bg-slate-800/50 text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">
                  This email address is from your invitation.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
              />
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-700 pb-4">
            <h2 className="text-sm font-semibold text-slate-200">Contact Information</h2>
            
            <div>
              <Label htmlFor="phone" className="text-slate-300">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-700 pb-4">
            <h2 className="text-sm font-semibold text-slate-200">Address (Optional)</h2>
            
            <div>
              <Label htmlFor="addressLine1" className="text-slate-300">
                Street Address
              </Label>
              <Input
                id="addressLine1"
                type="text"
                value={addressLine1}
                onChange={e => setAddressLine1(e.target.value)}
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
              />
            </div>

            <div>
              <Label htmlFor="addressLine2" className="text-slate-300">
                Apartment, suite, etc.
              </Label>
              <Input
                id="addressLine2"
                type="text"
                value={addressLine2}
                onChange={e => setAddressLine2(e.target.value)}
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="text-slate-300">
                  City
                </Label>
                <Input
                  id="city"
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
                />
              </div>

              <div>
                <Label htmlFor="state" className="text-slate-300">
                  State
                </Label>
                <Input
                  id="state"
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  maxLength={2}
                  className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
                  placeholder="CO"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="zipCode" className="text-slate-300">
                ZIP Code
              </Label>
              <Input
                id="zipCode"
                type="text"
                value={zipCode}
                onChange={e => setZipCode(e.target.value)}
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
                placeholder="80401"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Emergency Contact (Optional)</h2>
            
            <div>
              <Label htmlFor="emergencyContactName" className="text-slate-300">
                Emergency Contact Name
              </Label>
              <Input
                id="emergencyContactName"
                type="text"
                value={emergencyContactName}
                onChange={e => setEmergencyContactName(e.target.value)}
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
              />
            </div>

            <div>
              <Label htmlFor="emergencyContactPhone" className="text-slate-300">
                Emergency Contact Phone
              </Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                value={emergencyContactPhone}
                onChange={e => setEmergencyContactPhone(e.target.value)}
                className="mt-1 bg-slate-800 text-slate-100 border-slate-700"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 text-slate-900"
          >
            {loading ? 'Creating account…' : 'Sign Up'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-sky-400 hover:text-sky-300">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
