'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useClub } from '@/lib/club-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function SignupPage() {
  const router = useRouter()
  const { club } = useClub()
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

  // Load available clubs
  useEffect(() => {
    async function loadClubs() {
      try {
        const { data, error: clubsError } = await supabase
          .from('clubs')
          .select('id, name, slug')
          .order('name', { ascending: true })

        if (clubsError) {
          console.error('Error loading clubs:', clubsError)
        } else {
          setClubs(data || [])
          // Pre-select club from URL context if available
          if (club?.id) {
            setSelectedClubId(club.id)
          } else if (data && data.length > 0) {
            // Default to first club if no club in context
            setSelectedClubId(data[0].id)
          }
        }
      } catch (err) {
        console.error('Error loading clubs:', err)
      } finally {
        setLoadingClubs(false)
      }
    }

    loadClubs()
  }, [club])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Sign up the user (try without metadata first to isolate the issue)
      let authData, signUpError
      
      try {
        // Add timeout wrapper for signUp call
        const signUpPromise = supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login?confirmed=true`,
            // Temporarily remove metadata to see if that's causing the issue
            // data: {
            //   first_name: firstName || '',
            //   last_name: lastName || '',
            //   profile_pending: 'true',
            // },
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

      // 2. Get club ID (from selection, context, or default)
      let clubId = selectedClubId || club?.id
      if (!clubId) {
        const { data: defaultClub } = await supabase
          .from('clubs')
          .select('id')
          .eq('slug', 'default')
          .single()
        clubId = defaultClub?.id || null
      }

      if (!clubId) {
        setError('Please select a club to register with.')
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

      // Check if email confirmation is required
      if (!authData.session) {
        // Email confirmation is required
        router.push('/login?message=Account created! Please check your email to confirm your account, then log in.')
        setLoading(false)
        return
      }

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
        // Try families table as fallback
        const { error: familyError } = await supabase.from('families').insert([
          {
            profile_id: authData.user.id,
            club_id: clubId,
            email,
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

        if (familyError) {
          setError(`Failed to create household: ${householdError.message}`)
          setLoading(false)
          return
        }

        // Redirect to parent dashboard
        if (club?.slug) {
          router.push(`/clubs/${club.slug}/parent/dashboard`)
        } else {
          router.push('/login?message=Account created! Please log in.')
        }
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
                  <SelectContent>
                    {clubs.map(clubOption => (
                      <SelectItem key={clubOption.id} value={clubOption.id}>
                        {clubOption.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

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
