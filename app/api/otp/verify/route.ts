import { NextRequest, NextResponse } from 'next/server'
import { otpService, OTPType } from '@/lib/services/otp-service'
import { dbRateLimiter } from '@/lib/services/rate-limiter-db'
import { createAdminClient } from '@/lib/supabase/server'
import { otpSchema, ValidationError } from '@/lib/validation'
import { log } from '@/lib/logger'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    let validatedData
    try {
      const body = await request.json()
      validatedData = otpSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            validationErrors: error.issues.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        )
      }
      throw error
    }
    
    const body = validatedData
    const { userId, code, type, contact } = body

    // Validate required fields
    if (!userId || !code || !type || !contact) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, code, type, contact' },
        { status: 400 }
      )
    }

    // Validate OTP type
    const validTypes: OTPType[] = ['email_verification', 'phone_verification', 'admin_invitation', 'password_reset', '2fa_login']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid OTP type' },
        { status: 400 }
      )
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format. Code must be 6 digits.' },
        { status: 400 }
      )
    }

    // Check failed attempts rate limit (database-backed)
    const failedAttemptsCheck = await dbRateLimiter.checkFailedOTPAttempts(userId)
    if (!failedAttemptsCheck.allowed) {
      const hoursRemaining = Math.ceil((failedAttemptsCheck.resetAt.getTime() - Date.now()) / 3600000)
      return NextResponse.json(
        { 
          error: `Account temporarily locked due to too many failed attempts. Please try again in ${hoursRemaining} hour(s).`,
          resetAt: failedAttemptsCheck.resetAt.toISOString(),
          locked: true
        },
        { status: 429 }
      )
    }

    // Verify the OTP
    const result = await otpService.verify(userId, code, type, contact)

    if (!result.success) {
      // Record failed attempt (database-backed)
      await dbRateLimiter.recordFailedOTPAttempt(userId)
      
      return NextResponse.json(
        { 
          success: false,
          error: result.message,
          attemptsRemaining: result.attemptsRemaining
        },
        { status: 400 }
      )
    }

    // Success! Reset failed attempts counter
    await dbRateLimiter.resetFailedOTPAttempts(userId)

    // ========================================================================
    // EMAIL VERIFICATION FLOW - Complete user setup after OTP is verified
    // ========================================================================
    if (type === 'email_verification') {
      log.info('[OTP VERIFY] ===== Starting Email Verification Setup =====')
      log.info('[OTP VERIFY] User ID', { userId })
      
      try {
        const supabase = createAdminClient()
        
        // STEP 1: Confirm email in Supabase auth system
        // This is critical because we bypass Supabase's native email confirmation
        log.info('[OTP VERIFY] STEP 1: Confirming email in Supabase auth...')
        const { data: updateData, error: confirmError } = await supabase.auth.admin.updateUserById(
          userId,
          { email_confirm: true }
        )
        log.info('[OTP VERIFY] Email confirmation result', {
          success: !!updateData,
          error: confirmError?.message,
          userEmail: updateData?.user?.email
        })
        
        // STEP 2: Fetch profile (already updated with real name before OTP was sent)
        log.info('[OTP VERIFY] STEP 2: Fetching profile...')
        const { data: profile, error: profileFetchError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, phone, club_id')
          .eq('id', userId)
          .single()

        if (!profile || profileFetchError) {
          log.warn('[OTP VERIFY] No profile found')
          return NextResponse.json({
            success: true,
            message: result.message,
            warning: 'Profile setup incomplete - please contact support'
          })
        }

        // Mark email as verified on the profile
        await supabase
          .from('profiles')
          .update({ email_verified_at: new Date().toISOString() })
          .eq('id', userId)

        // Use profile data as signupData alias for household creation below
        const signupData = {
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          club_id: profile.club_id,
          address_line1: null,
          address_line2: null,
          city: null,
          state: null,
          zip_code: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
        }
        
        // STEP 3: Check/Create Household (for parent role only)
        // Note: Households don't have parent_id - we use household_guardians join table
        log.info('[OTP VERIFY] STEP 4: Checking if household exists via household_guardians...')
        const { data: existingGuardian, error: guardianCheckError } = await supabase
          .from('household_guardians')
          .select('household_id, households(id)')
          .eq('user_id', userId)
          .maybeSingle()
        
        if (!existingGuardian) {
          log.info('[OTP VERIFY] Creating household...')
          const { data: household, error: householdError } = await supabase
            .from('households')
            .insert([{
              club_id: signupData.club_id,
              primary_email: signupData.email,
              phone: signupData.phone,
              address_line1: signupData.address_line1,
              address_line2: signupData.address_line2,
              city: signupData.city,
              state: signupData.state,
              zip_code: signupData.zip_code,
              emergency_contact_name: signupData.emergency_contact_name,
              emergency_contact_phone: signupData.emergency_contact_phone,
            }])
            .select()
            .single()
          
          if (householdError) {
            console.error('[OTP VERIFY] ❌ Household creation failed:', householdError.message)
            return NextResponse.json({
              success: true,
              message: result.message,
              warning: 'Household creation failed - please contact support'
            })
          }
          
          log.info('[OTP VERIFY] Household created', { householdId: household?.id })
          
          // STEP 4: Link user to household via household_guardians
          log.info('[OTP VERIFY] STEP 5: Creating household_guardian link...')
          const { error: guardianLinkError } = await supabase
            .from('household_guardians')
            .insert([{
              household_id: household.id,
              user_id: userId,
              is_primary: true,
            }])
          
          if (guardianLinkError) {
            log.warn('[OTP VERIFY] Household guardian link failed', { error: guardianLinkError.message })
            // This IS critical - without the link, user won't have access to household
            return NextResponse.json({
              success: true,
              message: result.message,
              warning: 'Household guardian link failed - please contact support'
            })
          } else {
            log.info('[OTP VERIFY] Household guardian link created')
          }
        } else {
          log.info('[OTP VERIFY] Household already exists via guardian link')
        }
        
        log.info('[OTP VERIFY] ===== Setup Complete =====')
        
      } catch (setupError) {
        console.error('[OTP VERIFY] ❌ Critical error during setup:', setupError)
        // Don't fail the OTP verification, but log it
        return NextResponse.json({
          success: true,
          message: result.message,
          warning: 'Setup incomplete - please contact support'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: result.message
    })
  } catch (error) {
    console.error('OTP verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
