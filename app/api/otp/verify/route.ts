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
        
        // STEP 2: Fetch signup data
        log.info('[OTP VERIFY] STEP 2: Fetching signup data...')
        const { data: signupData, error: signupDataError } = await supabase
          .from('signup_data')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (!signupData) {
          log.warn('[OTP VERIFY] No signup data found - user cannot complete setup')
          // Still return success for OTP verification, but user will need manual setup
          return NextResponse.json({
            success: true,
            message: result.message,
            warning: 'Profile setup incomplete - please contact support'
          })
        }

        // Validate required profile fields
        if (!signupData.first_name || !signupData.last_name) {
          log.warn('[OTP VERIFY] Missing required profile fields')
          return NextResponse.json({
            success: false,
            message: 'First name and last name are required'
          }, { status: 400 })
        }
        
        // STEP 3: Check/Create Profile
        log.info('[OTP VERIFY] STEP 3: Checking if profile exists...')
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', userId)
          .single()
        
        log.info('[OTP VERIFY] Profile check', {
          exists: !!existingProfile,
          role: existingProfile?.role,
          error: profileCheckError?.message
        })
        
        if (!existingProfile) {
          log.info('[OTP VERIFY] Creating profile...')
          const { error: profileError } = await supabase.rpc('create_user_profile', {
            p_user_id: userId,
            p_email: signupData.email,
            p_first_name: signupData.first_name,
            p_last_name: signupData.last_name,
            p_role: 'parent', // Always parent for public signup
            p_club_id: signupData.club_id,
          })
          
          if (profileError) {
            console.error('[OTP VERIFY] ❌ Profile creation failed:', profileError.message)
            return NextResponse.json({
              success: true,
              message: result.message,
              warning: 'Profile creation failed - please contact support'
            })
          }
          
          log.info('[OTP VERIFY] Profile created')
        } else {
          // Profile exists (created by trigger stub) — update it with real name/club
          log.info('[OTP VERIFY] Updating existing profile with signup data...')
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({
              first_name: signupData.first_name,
              last_name: signupData.last_name,
              club_id: signupData.club_id,
            })
            .eq('id', userId)

          if (profileUpdateError) {
            log.warn('[OTP VERIFY] Profile update failed', { error: profileUpdateError.message })
          } else {
            log.info('[OTP VERIFY] Profile updated with real name')
          }
        }
        
        // STEP 4: Check/Create Household (for parent role only)
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
          
          // STEP 5: Link user to household via household_guardians
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
        
        // STEP 6: Clean up signup data
        log.info('[OTP VERIFY] STEP 6: Cleaning up signup_data...')
        await supabase
          .from('signup_data')
          .delete()
          .eq('user_id', userId)
        
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
