'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from './supabase/client'
import { useAuth } from './auth-context'

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
  const [supabase] = useState(() => createClient())
  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  // Track current club slug to avoid unnecessary reloads
  const [currentClubSlug, setCurrentClubSlug] = useState<string | null>(null)
  // Use AuthContext's profile to avoid duplicate getUser() calls
  const { profile, loading: authLoading } = useAuth()
  // Track if we've already loaded the club for this user to prevent loops
  const [hasLoadedUserClub, setHasLoadedUserClub] = useState(false)
  // Track which user we loaded the club for (to detect user changes)
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null)

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
        setCurrentClubSlug(null)
        return
      }

      // Only update if club data actually changed to prevent unnecessary re-renders
      setClub(prevClub => {
        if (prevClub && 
            prevClub.id === data.id && 
            prevClub.name === data.name && 
            prevClub.slug === data.slug &&
            prevClub.logo_url === data.logo_url &&
            prevClub.primary_color === data.primary_color) {
          return prevClub // Return same object reference if nothing changed
        }
        return data as Club
      })
      setCurrentClubSlug(clubSlug)
    } catch (err) {
      console.error('Error loading club:', err)
      setError('Failed to load club')
      setClub(null)
      setCurrentClubSlug(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const clubSlug = getClubSlugFromPath(pathname)

    // Wait for auth to load
    if (authLoading) {
      return
    }

    // Reset if user changed (detect logout/login)
    if (profile && profile.id !== loadedForUserId) {
      setHasLoadedUserClub(false)
      setLoadedForUserId(profile.id)
    }

    // For regular admins (not system_admin), ALWAYS load their club from profile, ignore URL
    // This prevents infinite redirects when they try to access other clubs
    if (profile && profile.role === 'admin' && !hasLoadedUserClub) {
      // Regular admin - load their club from profile only once
      if (profile.club_id) {
        const loadAdminClub = async () => {
          try {
            setLoading(true)
            const { data: clubData, error: clubError } = await supabase
              .from('clubs')
              .select('id, name, slug, logo_url, primary_color')
              .eq('id', profile.club_id)
              .single()

            if (clubError) {
              console.error('Error loading admin club:', clubError)
              setError(`Failed to load club: ${clubError.message}`)
            } else if (clubData) {
              setClub(clubData as Club)
              setCurrentClubSlug(clubData.slug)
              setHasLoadedUserClub(true)
            }
          } catch (err) {
            console.error('Error loading club from profile:', err)
            setError('Failed to load club information')
          } finally {
            setLoading(false)
          }
        }
        loadAdminClub()
      }
      return
    }

    // For system_admin or other roles, load club based on URL
    if (clubSlug) {
      // If club slug in URL and it's different from current, load that club
      if (clubSlug !== currentClubSlug) {
        loadClub(clubSlug)
      } else if (loading) {
        // Club slug is same as current - no need to reload, just ensure loading is false
        // Only update if currently loading to prevent infinite re-renders
        setLoading(false)
      }
    } else {
      // No club slug in URL - this is a legacy route
      if (!club && profile && profile.club_id) {
        // If no club slug, get user's club from profile (already loaded in AuthContext)
        // This handles legacy routes like /admin, /dashboard
        const clubId = profile.club_id // Capture club_id before async function
        async function loadClubFromProfile() {
          try {
            setLoading(true)
            const { data: clubData, error: clubError } = await supabase
              .from('clubs')
              .select('id, name, slug, logo_url, primary_color')
              .eq('id', clubId)
              .single()

            if (clubError) {
              console.error('Error loading club:', clubError)
              setError(`Failed to load club: ${clubError.message}`)
            } else if (clubData) {
              // Only update if club data actually changed to prevent unnecessary re-renders
              setClub(prevClub => {
                if (prevClub && 
                    prevClub.id === clubData.id && 
                    prevClub.name === clubData.name && 
                    prevClub.slug === clubData.slug &&
                    prevClub.logo_url === clubData.logo_url &&
                    prevClub.primary_color === clubData.primary_color) {
                  return prevClub // Return same object reference if nothing changed
                }
                return clubData as Club
              })
              setCurrentClubSlug(clubData.slug)
            }
          } catch (err) {
            console.error('Error loading club from profile:', err)
            setError('Failed to load club information')
          } finally {
            setLoading(false)
          }
        }

        loadClubFromProfile()
      } else if (club && loading) {
        // Already have club loaded for legacy route - no need to fetch again
        // Only update if currently loading to prevent infinite re-renders
        setLoading(false)
      } else if (!profile && loading) {
        // No profile (user not logged in) - no club to load
        // Only update if currently loading to prevent infinite re-renders
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, currentClubSlug, profile?.club_id, authLoading, loading, profile?.role, hasLoadedUserClub, profile?.id, loadedForUserId])

  const refreshClub = async () => {
    const clubSlug = getClubSlugFromPath(pathname)
    if (clubSlug) {
      await loadClub(clubSlug)
    } else if (club?.slug) {
      // If on legacy route, reload current club
      await loadClub(club.slug)
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

