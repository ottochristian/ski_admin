import { NextRequest, NextResponse } from 'next/server'
import { otpService, OTPType } from '@/lib/services/otp-service'
import { dbRateLimiter } from '@/lib/services/rate-limiter-db'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
      console.log('[OTP VERIFY] ===== Starting Email Verification Setup =====')
      console.log('[OTP VERIFY] User ID:', userId)
      
      try {
        const supabase = createAdminClient()
        
        // STEP 1: Confirm email in Supabase auth system
        // This is critical because we bypass Supabase's native email confirmation
        console.log('[OTP VERIFY] STEP 1: Confirming email in Supabase auth...')
        const { data: updateData, error: confirmError } = await supabase.auth.admin.updateUserById(
          userId,
          { email_confirm: true }
        )
        console.log('[OTP VERIFY] Email confirmation result:', { 
          success: !!updateData, 
          error: confirmError?.message,
          userEmail: updateData?.user?.email 
        })
        
        // STEP 2: Fetch signup data
        console.log('[OTP VERIFY] STEP 2: Fetching signup data...')
        const { data: signupData, error: signupDataError } = await supabase
          .from('signup_data')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        console.log('[OTP VERIFY] Signup data result:', { 
          found: !!signupData, 
          error: signupDataError?.message,
          clubId: signupData?.club_id,
          email: signupData?.email 
        })
        
        if (!signupData) {
          console.log('[OTP VERIFY] ❌ No signup data found - user cannot complete setup')
          // Still return success for OTP verification, but user will need manual setup
          return NextResponse.json({
            success: true,
            message: result.message,
            warning: 'Profile setup incomplete - please contact support'
          })
        }
        
        // STEP 3: Check/Create Profile
        console.log('[OTP VERIFY] STEP 3: Checking if profile exists...')
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', userId)
          .single()
        
        console.log('[OTP VERIFY] Profile check:', { 
          exists: !!existingProfile, 
          role: existingProfile?.role,
          error: profileCheckError?.message 
        })
        
        if (!existingProfile) {
          console.log('[OTP VERIFY] Creating profile...')
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
          
          console.log('[OTP VERIFY] ✅ Profile created')
        } else {
          console.log('[OTP VERIFY] Profile already exists')
        }
        
        // STEP 4: Check/Create Household (for parent role only)
        // Note: Households don't have parent_id - we use household_guardians join table
        console.log('[OTP VERIFY] STEP 4: Checking if household exists via household_guardians...')
        const { data: existingGuardian, error: guardianCheckError } = await supabase
          .from('household_guardians')
          .select('household_id, households(id)')
          .eq('user_id', userId)
          .maybeSingle()
        
        console.log('[OTP VERIFY] Household guardian check:', { 
          exists: !!existingGuardian, 
          error: guardianCheckError?.message 
        })
        
        if (!existingGuardian) {
          console.log('[OTP VERIFY] Creating household...')
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
          
          console.log('[OTP VERIFY] ✅ Household created:', household?.id)
          
          // STEP 5: Link user to household via household_guardians
          console.log('[OTP VERIFY] STEP 5: Creating household_guardian link...')
          const { error: guardianLinkError } = await supabase
            .from('household_guardians')
            .insert([{
              household_id: household.id,
              user_id: userId,
              is_primary: true,
            }])
          
          if (guardianLinkError) {
            console.log('[OTP VERIFY] ❌ Household guardian link failed:', guardianLinkError.message)
            // This IS critical - without the link, user won't have access to household
            return NextResponse.json({
              success: true,
              message: result.message,
              warning: 'Household guardian link failed - please contact support'
            })
          } else {
            console.log('[OTP VERIFY] ✅ Household guardian link created')
          }
        } else {
          console.log('[OTP VERIFY] Household already exists via guardian link')
        }
        
        // STEP 6: Clean up signup data
        console.log('[OTP VERIFY] STEP 6: Cleaning up signup_data...')
        await supabase
          .from('signup_data')
          .delete()
          .eq('user_id', userId)
        
        console.log('[OTP VERIFY] ===== Setup Complete ===== ✅')
        
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
