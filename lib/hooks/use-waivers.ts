import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '../supabase/client'
import { useClub } from '@/lib/club-context'
import { useAuth } from '../auth-context'

export interface Waiver {
  id: string
  club_id: string
  season_id: string
  title: string
  body: string
  required: boolean
  status: 'active' | 'inactive' | 'archived'
  created_at: string
  updated_at: string
  created_by?: string
}

export interface WaiverSignature {
  id: string
  waiver_id: string
  athlete_id: string
  guardian_id: string
  signed_at: string
  signed_name: string
  ip_address?: string
  user_agent?: string
}

// Hook to fetch waivers for current club and season
export function useWaivers(seasonId?: string) {
  const { club } = useClub()

  return useQuery({
    queryKey: ['waivers', club?.id, seasonId],
    queryFn: async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/use-waivers.ts:36',message:'useWaivers queryFn entry',data:{clubId:club?.id,seasonId,hasClub:!!club?.id,hasSeason:!!seasonId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (!club?.id || !seasonId) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/use-waivers.ts:40',message:'useWaivers early return',data:{clubId:club?.id,seasonId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return []
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('waivers')
        .select('*')
        .eq('club_id', club.id)
        .eq('season_id', seasonId)
        .order('created_at', { ascending: false })

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/use-waivers.ts:49',message:'useWaivers query result',data:{clubId:club.id,seasonId,waiverCount:data?.length||0,error:error?.message||null,waivers:data?.map((w:any)=>({id:w.id,title:w.title,required:w.required,status:w.status}))||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (error) throw error
      return data
    },
    enabled: !!club?.id && !!seasonId,
  })
}

// Hook to create a new waiver
export function useCreateWaiver() {
  const queryClient = useQueryClient()
  const { club } = useClub()
  const { user, profile } = useAuth()

  return useMutation({
    mutationFn: async (waiver: {
      title: string
      body: string
      required: boolean
      seasonId: string
    }) => {
      if (!club?.id) throw new Error('No club selected')
      if (!user || !profile) throw new Error('Not authenticated')

      // Direct INSERT - RLS policies should handle security
      const supabase = createClient()
      const insertData = {
        club_id: club.id,
        season_id: waiver.seasonId,
        title: waiver.title,
        body: waiver.body,
        required: waiver.required,
        created_by: profile.id, // Use profile.id (which matches auth.users.id)
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/use-waivers.ts:86',message:'createWaiver insert data',data:insertData,waiverData:waiver,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const { data, error } = await supabase
        .from('waivers')
        .insert(insertData)
        .select()
        .single()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/use-waivers.ts:95',message:'createWaiver result',data:{insertedRequired:data?.required,insertedId:data?.id,error:error?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      if (error) {
        const errorMessage = error.message || error.hint || error.details || JSON.stringify(error)
        throw new Error(`Failed to create waiver: ${errorMessage}`)
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waivers'] })
    },
  })
}

// Hook to update an existing waiver
export function useUpdateWaiver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (waiver: {
      id: string
      title: string
      body: string
      required: boolean
    }) => {
      // Direct UPDATE - RLS policies should handle security
      const supabase = createClient()
      const updateData = {
        title: waiver.title,
        body: waiver.body,
        required: waiver.required,
        updated_at: new Date().toISOString(),
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/use-waivers.ts:127',message:'updateWaiver update data',data:{updateData,waiverId:waiver.id,receivedRequired:waiver.required},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const { data, error } = await supabase
        .from('waivers')
        .update(updateData)
        .eq('id', waiver.id)
        .select()
        .single()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/hooks/use-waivers.ts:137',message:'updateWaiver result',data:{updatedRequired:data?.required,updatedId:data?.id,error:error?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      if (error) {
        const errorMessage = error.message || error.hint || error.details || JSON.stringify(error)
        throw new Error(`Failed to update waiver: ${errorMessage}`)
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waivers'] })
    },
  })
}

// Hook to sign a waiver
export function useSignWaiver() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (signature: {
      waiverId: string
      athleteId: string
      guardianId: string
      signedName: string
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('waiver_signatures')
        .insert({
          waiver_id: signature.waiverId,
          athlete_id: signature.athleteId,
          guardian_id: signature.guardianId,
          signed_name: signature.signedName,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiver-signatures'] })
      queryClient.invalidateQueries({ queryKey: ['athlete-waiver-status'] })
    },
  })
}

// Hook to check waiver status for an athlete
export function useAthleteWaiverStatus(athleteId?: string) {
  return useQuery({
    queryKey: ['athlete-waiver-status', athleteId],
    queryFn: async () => {
      if (!athleteId) return []

      const supabase = createClient()
      const { data, error } = await supabase
        .from('athlete_waiver_status')
        .select('*')
        .eq('athlete_id', athleteId)

      if (error) throw error
      return data
    },
    enabled: !!athleteId,
  })
}

// Hook to check if athlete has signed required waivers
export function useHasSignedRequiredWaivers(athleteId?: string) {
  return useQuery({
    queryKey: ['has-signed-required-waivers', athleteId],
    queryFn: async () => {
      if (!athleteId) return false

      const supabase = createClient()
      const { data, error } = await supabase
        .rpc('has_signed_required_waivers', {
          p_athlete_id: athleteId,
        })

      if (error) throw error
      return data
    },
    enabled: !!athleteId,
  })
}

// Hook to get waiver signatures for a guardian's athletes
export function useWaiverSignatures(guardianId?: string) {
  return useQuery({
    queryKey: ['waiver-signatures', guardianId],
    queryFn: async () => {
      if (!guardianId) return []

      const supabase = createClient()
      const { data, error } = await supabase
        .from('waiver_signatures')
        .select(`
          *,
          waivers (
            id,
            title,
            body,
            required,
            season_id
          ),
          athletes (
            id,
            first_name,
            last_name
          )
        `)
        .eq('guardian_id', guardianId)
        .order('signed_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!guardianId,
  })
}
