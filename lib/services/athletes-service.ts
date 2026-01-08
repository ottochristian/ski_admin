import { BaseService, handleSupabaseError, QueryResult } from './base-service'
import { getServiceClient } from './service-client'

/**
 * Service for athlete-related database operations
 * PHASE 2: RLS-FIRST APPROACH - RLS handles club filtering automatically
 */
export class AthletesService extends BaseService {
  constructor(supabase = getServiceClient()) {
    super(supabase)
  }

  /**
   * Get all athletes for the authenticated user's club
   * RLS automatically filters by club - no manual filtering needed!
   * Includes registration data for displaying tags
   */
  async getAthletes(): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('athletes')
      .select(`
        *,
        registrations (
          id,
          status,
          payment_status,
          season_id,
          sub_program_id,
          seasons (
            id,
            name,
            is_current
          ),
          sub_programs (
            id,
            name,
            programs (
              id,
              name
            )
          )
        )
      `)
      .order('first_name', { ascending: true })

    return handleSupabaseError(result)
  }

  /**
   * Get athlete by ID
   * RLS ensures user can only access athletes in their club
   */
  async getAthleteById(athleteId: string): Promise<QueryResult<any>> {
    const result = await this.supabase
      .from('athletes')
      .select('*')
      .eq('id', athleteId)
      .single()

    return handleSupabaseError(result)
  }

  /**
   * Get athletes by household ID
   * RLS ensures user can only access athletes in their household
   */
  async getAthletesByHousehold(householdId: string): Promise<QueryResult<any[]>> {
    const result = await this.supabase
      .from('athletes')
      .select('*')
      .eq('household_id', householdId)
      .order('first_name', { ascending: true })

    return handleSupabaseError(result)
  }

  /**
   * Count athletes
   * RLS automatically filters by club
   */
  async countAthletes(): Promise<QueryResult<number>> {
    const result = await this.supabase
      .from('athletes')
      .select('*', { count: 'exact', head: true })

    if (result.error) {
      return {
        data: null,
        error: new Error(result.error.message || 'Failed to count athletes'),
      }
    }

    return {
      data: result.count || 0,
      error: null,
    }
  }

  /**
   * Update athlete by ID
   * RLS ensures user can only update athletes they have access to
   * Note: The supabase client passed to constructor MUST have the authenticated session
   */
  async updateAthlete(athleteId: string, updates: Partial<{
    first_name: string
    last_name: string
    date_of_birth: string
    gender: string
    ussa_number: string | null
    fis_license: string | null
    medical_notes: string | null
  }>): Promise<QueryResult<any>> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:124',message:'updateAthlete called',data:{athleteId,updates},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // First, check athlete data and RLS relationship before update
    const athleteCheck = await this.supabase
      .from('athletes')
      .select('id, household_id, club_id')
      .eq('id', athleteId)
      .maybeSingle()

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:133',message:'athlete data check before update',data:{athleteCheck:athleteCheck.data,error:athleteCheck.error?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // Check current user's auth
    const { data: { user } } = await this.supabase.auth.getUser()
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:140',message:'current user check',data:{userId:user?.id||null,email:user?.email||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // Check household_guardians relationship if athlete has household_id
    if (athleteCheck.data?.household_id && user?.id) {
      const hgCheck = await this.supabase
        .from('household_guardians')
        .select('*')
        .eq('user_id', user.id)
        .eq('household_id', athleteCheck.data.household_id)
        .maybeSingle()

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:150',message:'household_guardians relationship check',data:{found:hgCheck.data!==null,householdId:athleteCheck.data.household_id,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    }

    // First verify we can read the athlete (for debugging)
    // Then attempt the update
    // Use .update() without .select() first to see if it affects rows
    // If it does, then select the updated row
    const updateResult = await this.supabase
      .from('athletes')
      .update(updates)
      .eq('id', athleteId)

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:168',message:'direct update result',data:{error:updateResult.error?.message||null,errorCode:updateResult.error?.code||null,hasError:!!updateResult.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (updateResult.error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:173',message:'update error from Supabase',data:{error:updateResult.error.message,code:updateResult.error.code,details:updateResult.error.details,hint:updateResult.error.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return handleSupabaseError(updateResult)
    }

    // Now select the updated row
    const result = await this.supabase
      .from('athletes')
      .select()
      .eq('id', athleteId)
      .maybeSingle()

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:139',message:'update query result',data:{error:result.error?.message||null,errorCode:result.error?.code||null,hasData:!!result.data,dataMedicalNotes:result.data?.medical_notes||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (result.error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:143',message:'update error detected',data:{error:result.error.message,code:result.error.code,details:result.error.details,hint:result.error.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return handleSupabaseError(result)
    }

    // If no data returned, the update might have succeeded but RLS blocked read-back
    // Or the athlete doesn't exist. Either way, return success since update() didn't error
    if (!result.data) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:150',message:'update returned no data - checking if update actually succeeded',timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Verify update actually happened by checking if row exists and can be read
      const verifyResult = await this.supabase
        .from('athletes')
        .select('id, medical_notes')
        .eq('id', athleteId)
        .maybeSingle()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:156',message:'verification query result',data:{error:verifyResult.error?.message||null,hasData:!!verifyResult.data,verifyMedicalNotes:verifyResult.data?.medical_notes||null,expectedMedicalNotes:updates.medical_notes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // If we can read it but it's different, update failed silently
      if (verifyResult.data && verifyResult.data.medical_notes !== updates.medical_notes) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:161',message:'UPDATE FAILED - medical notes did not change',data:{expected:updates.medical_notes,actual:verifyResult.data.medical_notes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return {
          data: null,
          error: new Error('Update did not affect any rows - RLS may have blocked the update'),
        }
      }
      
      // If we can read it and it matches, update succeeded but select didn't return it
      if (verifyResult.data && verifyResult.data.medical_notes === updates.medical_notes) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:170',message:'UPDATE SUCCEEDED - verified by separate query',data:{medical_notes:verifyResult.data.medical_notes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return {
          data: verifyResult.data,
          error: null,
        }
      }
      
      // Can't verify - return null data but no error
      return {
        data: null,
        error: null,
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/services/athletes-service.ts:184',message:'update succeeded with data returned',data:{medical_notes:result.data.medical_notes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    return {
      data: result.data,
      error: null,
    }
  }
}

export const athletesService = new AthletesService(getServiceClient())


