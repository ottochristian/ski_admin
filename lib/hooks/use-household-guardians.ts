import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { householdGuardiansService } from '@/lib/services/household-guardians-service'
import { useAuth } from '@/lib/auth-context'

export interface Guardian {
  id: string
  household_id: string
  user_id: string
  is_primary: boolean
  created_at: string
  profiles: {
    id: string
    email: string
    first_name?: string | null
    last_name?: string | null
    avatar_url?: string | null
  }
}

export interface GuardianInvitation {
  id: string
  household_id: string
  invited_by_user_id: string
  email: string
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
  accepted_at?: string | null
  cancelled_at?: string | null
}

/**
 * Hook to get all guardians for a household
 */
export function useHouseholdGuardians(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ['household-guardians', householdId],
    queryFn: async () => {
      if (!householdId) return []
      const result = await householdGuardiansService.getGuardiansForHousehold(householdId)
      if (result.error) throw result.error
      return (result.data || []) as Guardian[]
    },
    enabled: !!householdId,
  })
}

/**
 * Hook to get pending invitations for a household
 */
export function usePendingGuardianInvitations(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ['guardian-invitations', householdId, 'pending'],
    queryFn: async () => {
      if (!householdId) return []
      const result = await householdGuardiansService.getPendingInvitationsForHousehold(householdId)
      if (result.error) throw result.error
      return (result.data || []) as GuardianInvitation[]
    },
    enabled: !!householdId,
  })
}

/**
 * Hook to invite a secondary guardian
 */
export function useInviteGuardian() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (email: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/household-guardians/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      return data
    },
    onSuccess: () => {
      // Invalidate guardians and invitations queries
      queryClient.invalidateQueries({ queryKey: ['household-guardians'] })
      queryClient.invalidateQueries({ queryKey: ['guardian-invitations'] })
    },
  })
}

/**
 * Hook to accept a guardian invitation
 */
export function useAcceptGuardianInvitation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (token: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/household-guardians/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation')
      }

      return data
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['household-guardians'] })
      queryClient.invalidateQueries({ queryKey: ['guardian-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['parent-household'] })
      queryClient.invalidateQueries({ queryKey: ['athletes'] })
    },
  })
}

/**
 * Hook to remove a secondary guardian
 */
export function useRemoveGuardian() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (guardianId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const result = await householdGuardiansService.removeGuardian(guardianId)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      // Invalidate guardians query
      queryClient.invalidateQueries({ queryKey: ['household-guardians'] })
    },
  })
}

/**
 * Hook to cancel a pending invitation
 */
export function useCancelGuardianInvitation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const result = await householdGuardiansService.cancelInvitation(invitationId)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      // Invalidate invitations query
      queryClient.invalidateQueries({ queryKey: ['guardian-invitations'] })
    },
  })
}

/**
 * Hook to resend a guardian invitation with a new token
 */
export function useResendGuardianInvitation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/household-guardians/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitationId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      return data
    },
    onSuccess: () => {
      // Invalidate invitations query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['guardian-invitations'] })
    },
  })
}

