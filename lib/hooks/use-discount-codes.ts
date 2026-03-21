'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type DiscountCodeType = 'percent' | 'fixed'

export interface DiscountCode {
  id: string
  club_id: string
  season_id: string | null
  code: string
  description: string | null
  type: DiscountCodeType
  value: number
  min_order_cents: number
  max_uses: number | null
  max_uses_per_household: number | null
  max_uses_per_athlete: number | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  created_at: string
  use_count: number
}

async function getSession() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session
}

async function authHeaders() {
  const session = await getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  }
}

export function useDiscountCodes(seasonId?: string | null) {
  return useQuery<DiscountCode[]>({
    queryKey: ['discount-codes', seasonId ?? 'all'],
    queryFn: async () => {
      const headers = await authHeaders()
      const url = seasonId
        ? `/api/admin/discount-codes?seasonId=${seasonId}`
        : '/api/admin/discount-codes'
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error('Failed to load discount codes')
      const json = await res.json()
      return json.codes
    },
  })
}

export function useCreateDiscountCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<DiscountCode, 'id' | 'club_id' | 'created_at' | 'use_count'>) => {
      const headers = await authHeaders()
      const res = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create code')
      return json.code as DiscountCode
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  })
}

export function useUpdateDiscountCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<DiscountCode> & { id: string }) => {
      const headers = await authHeaders()
      const res = await fetch(`/api/admin/discount-codes/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update code')
      return json.code as DiscountCode
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  })
}

export function useDeactivateDiscountCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const headers = await authHeaders()
      const res = await fetch(`/api/admin/discount-codes/${id}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok && res.status !== 204) throw new Error('Failed to deactivate code')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  })
}
