'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from './supabaseClient'

export interface Club {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  primary_color?: string | null
}

interface ClubContextType {
  club: Club | null
  loading: boolean
  error: string | null
  refreshClub: () => Promise<void>
}

const ClubContext = createContext<ClubContextType | undefined>(undefined)

export function ClubProvider({ children }: { children: ReactNode }) {
  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Extract club slug from URL: /clubs/[clubSlug]/...
  const getClubSlugFromPath = (path: string): string | null => {
    const match = path.match(/^\/clubs\/([^/]+)/)
    return match ? match[1] : null
  }

  const loadClub = async (clubSlug: string) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: clubError } = await supabase
        .from('clubs')
        .select('id, name, slug, logo_url, primary_color')
        .eq('slug', clubSlug)
        .single()

      if (clubError) {
        setError(`Club not found: ${clubSlug}`)
        setClub(null)
        return
      }

      setClub(data as Club)
    } catch (err) {
      console.error('Error loading club:', err)
      setError('Failed to load club')
      setClub(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const clubSlug = getClubSlugFromPath(pathname)

    if (clubSlug) {
      // If club slug in URL, load that club
      loadClub(clubSlug)
    } else {
      // If no club slug, get user's club from profile
      // This handles legacy routes like /admin, /dashboard
      async function getUserClub() {
        try {
          setLoading(true)
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            setLoading(false)
            return
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('club_id')
            .eq('id', user.id)
            .single()

          if (profile?.club_id) {
            const { data: clubData, error: clubError } = await supabase
              .from('clubs')
              .select('id, name, slug, logo_url, primary_color')
              .eq('id', profile.club_id)
              .single()

            if (clubError) {
              console.error('Error loading club:', clubError)
              setError(`Failed to load club: ${clubError.message}`)
            } else if (clubData) {
              setClub(clubData as Club)
            }
          } else {
            console.warn('User profile has no club_id')
          }
        } catch (err) {
          console.error('Error getting user club:', err)
          setError('Failed to load club information')
        } finally {
          setLoading(false)
        }
      }

      getUserClub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const refreshClub = async () => {
    const clubSlug = getClubSlugFromPath(pathname)
    if (clubSlug) {
      await loadClub(clubSlug)
    }
  }

  return (
    <ClubContext.Provider value={{ club, loading, error, refreshClub }}>
      {children}
    </ClubContext.Provider>
  )
}

export function useClub() {
  const context = useContext(ClubContext)
  if (context === undefined) {
    throw new Error('useClub must be used within a ClubProvider')
  }
  return context
}

