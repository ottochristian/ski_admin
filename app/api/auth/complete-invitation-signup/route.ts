import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { log } from '@/lib/logger'

/**
 * API route to complete signup for users coming from guardian invitation
 * Skips email verification since email is already verified (they received invitation email)
 * Creates profile and household directly
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, firstName, lastName, phone, addressLine1, addressLine2, city, state, zipCode, emergencyContactName, emergencyContactPhone, clubId } = body

    if (!userId || !email || !clubId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, clubId' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:20',message:'Starting invitation signup completion',data:{userId,email,clubId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // STEP 1: Confirm email in Supabase auth (skip OTP verification)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:25',message:'Confirming email in Supabase auth',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const { data: updateData, error: confirmError } = await supabase.auth.admin.updateUserById(
      userId,
      { email_confirm: true }
    )

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:32',message:'Email confirmation result',data:{success:!!updateData,error:confirmError?.message,userEmail:updateData?.user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (confirmError) {
      log.error('Error confirming email for invitation signup', confirmError)
      return NextResponse.json(
        { error: 'Failed to confirm email' },
        { status: 500 }
      )
    }

    // STEP 2: Check/Create Profile
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:44',message:'Checking if profile exists',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle()

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:51',message:'Profile check result',data:{exists:!!existingProfile,role:existingProfile?.role,error:profileCheckError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!existingProfile) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:65',message:'Creating profile',data:{userId,email,clubId,firstName,lastName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Try using RPC function first (handles edge cases better), fallback to direct insert
      let profileError = null
      let profileCreated = false
      
      try {
        const { error: rpcError } = await supabase.rpc('create_user_profile', {
          p_user_id: userId,
          p_email: email,
          p_first_name: firstName || null,
          p_last_name: lastName || null,
          p_role: 'parent',
          p_club_id: clubId,
        })
        
        if (rpcError) {
          profileError = rpcError
        } else {
          profileCreated = true
        }
      } catch (rpcErr) {
        // If RPC fails, try direct insert
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: email,
            first_name: firstName || null,
            last_name: lastName || null,
            role: 'parent',
            club_id: clubId,
          })
        
        if (insertError) {
          profileError = insertError
        } else {
          profileCreated = true
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:95',message:'Profile creation result',data:{error:profileError?.message,code:profileError?.code,details:profileError?.details,hint:profileError?.hint,success:!profileError,profileCreated},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (profileError) {
        log.error('Error creating profile for invitation signup', profileError)
        // Check if it's a duplicate key error (profile already exists)
        if (profileError.code === '23505') {
          // Profile already exists, continue
          log.info('Profile already exists, continuing...')
        } else {
          return NextResponse.json(
            { 
              error: `Failed to create profile: ${profileError.message}`,
              details: profileError.details,
              hint: profileError.hint,
            },
            { status: 500 }
          )
        }
      }
      
      // Verify profile was created (even if no error, RLS might have blocked it)
      if (!profileCreated || profileError?.code === '23505') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:110',message:'Verifying profile exists after creation',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        const { data: verifyProfile, error: verifyError } = await supabase
          .from('profiles')
          .select('id, email, club_id')
          .eq('id', userId)
          .maybeSingle()
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:118',message:'Profile verification result',data:{exists:!!verifyProfile,email:verifyProfile?.email,clubId:verifyProfile?.club_id,error:verifyError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        if (!verifyProfile && !verifyError) {
          log.error('Profile creation failed - profile does not exist after insert')
          return NextResponse.json(
            { error: 'Failed to create profile - profile was not created. Please contact support.' },
            { status: 500 }
          )
        }
      }
    }

    // STEP 3: For invitation signups, we DON'T create a household
    // The user will be added to the existing household when they accept the invitation
    // The accept invitation API route will handle adding them to the household_guardians table
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:79',message:'Skipping household creation for invitation signup - will be added when accepting invitation',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/complete-invitation-signup/route.ts:145',message:'Invitation signup completion successful',data:{userId,email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Email verified automatically.',
    })
  } catch (error) {
    log.error('Error completing invitation signup', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

