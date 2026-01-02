'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from './supabase/client'
import { Profile } from './types'
import { useQueryClient } from '@tanstack/react-query'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Helper to wrap Supabase calls with timeout
 * Prevents indefinite hanging when Supabase client becomes unresponsive
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => 
    setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
  )
  return Promise.race([promise, timeoutPromise])
}

/**
 * Unified authentication provider for the entire application
 * Handles user authentication, profile loading, and session management
 * Replaces duplicate auth logic across layouts and hooks
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadRef = useRef(true)
  const loadAuthInProgressRef = useRef(false) // Prevent concurrent auth loads
  const lastAuthEventRef = useRef<{ event: string; timestamp: number } | null>(null) // Track events

  // Load user and profile
  // showLoader: set to false when refreshing token (user already authenticated)
  const loadAuth = async (showLoader = true) => {
    // Prevent concurrent loads - if one is in progress, skip
    if (loadAuthInProgressRef.current) {
      return
    }

    loadAuthInProgressRef.current = true

    try {
      if (showLoader) {
        setLoading(true)
      }
      setError(null)

      // First check if we have a session (localStorage only, no network call)
      // This prevents "Auth session missing!" errors when user is not logged in
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        10000,
        'getSession'
      )

      if (!session) {
        // No session - user is not logged in, this is normal for login page
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }


      // Get current user (validates session with server)
      const {
        data: { user: currentUser },
        error: userError,
      } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        'getUser'
      )


      if (userError) {
        console.error('Auth error:', userError)
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      if (!currentUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser(currentUser)


      // Load profile
      const { data: profileData, error: profileError } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', currentUser.id).single(),
        10000,
        'profile query'
      )


      if (profileError) {
        console.error('Profile error:', profileError)
        setError('Failed to load profile')
        setProfile(null)
        setLoading(false)
        return
      }

      // Only update profile if data actually changed (prevents unnecessary re-renders)
      setProfile(prevProfile => {
        const newProfile = profileData as Profile
        if (prevProfile &&
            prevProfile.id === newProfile.id &&
            prevProfile.email === newProfile.email &&
            prevProfile.role === newProfile.role &&
            prevProfile.club_id === newProfile.club_id &&
            prevProfile.first_name === newProfile.first_name &&
            prevProfile.last_name === newProfile.last_name) {
          return prevProfile // Return same reference if nothing changed
        }
        return newProfile
      })

      setError(null)
      
      // Only set loading to false if we explicitly showed the loader
      if (showLoader) {
        setLoading(false)
      }
    } catch (err) {
      console.error('Auth load error:', err)
      
      // If it's a timeout, show specific error
      const errorMessage = err instanceof Error && err.message.includes('timeout')
        ? 'Authentication request timed out. Please refresh the page.'
        : 'An error occurred during authentication'
      
      setError(errorMessage)
      setUser(null)
      setProfile(null)
      setLoading(false)
      
      // If timeout on non-login page, redirect to login
      if (err instanceof Error && err.message.includes('timeout') && pathname !== '/login') {
        router.push('/login')
      }
    } finally {
      // Always clear the in-progress flag
      loadAuthInProgressRef.current = false
    }
  }

  // Initial load
  useEffect(() => {
    loadAuth().then(() => {
      // Mark initial load as complete after first auth load
      initialLoadRef.current = false
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const now = Date.now()
      

      // Debounce duplicate events within 5 seconds
      if (lastAuthEventRef.current && 
          lastAuthEventRef.current.event === event && 
          now - lastAuthEventRef.current.timestamp < 5000) {
        return
      }

      lastAuthEventRef.current = { event, timestamp: now }

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
        setProfile(null)
        
        // Only redirect to login if on a protected route
        // Public routes like '/', '/login', '/signup' should not auto-redirect
        const publicRoutes = ['/', '/login', '/signup', '/setup-password']
        const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route))
        
        if (!isPublicRoute) {
          router.push('/login')
        }
      } else if (event === 'SIGNED_IN') {
        // If this is the initial load, show the loader (first time sign in)
        // After initial load, this is a tab switch - silent refresh (no loader)
        
        // Only reload auth on SIGNED_IN if this is the initial load
        // Subsequent SIGNED_IN events (which shouldn't happen) will be ignored
        if (initialLoadRef.current) {
          await loadAuth(true)
        } else {
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Silent refresh on token refresh (no loader, user already authenticated)
        await loadAuth(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname])

  // Refresh profile (useful after profile updates)
  const refreshProfile = async () => {
    if (!user) return

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile refresh error:', profileError)
        return
      }

      setProfile(profileData as Profile)
    } catch (err) {
      console.error('Profile refresh error:', err)
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      // Clear ALL React Query cache on sign out to prevent stale data across sessions
      queryClient.clear()
      
      await supabase.auth.signOut()
      
      setUser(null)
      setProfile(null)
      
      // Force a hard navigation to login page
      // Using window.location.href instead of router.push() for reliable full page reload
      // This ensures all client-side state is cleared and server components re-render
      window.location.href = '/login'
    } catch (err) {
      console.error('Sign out error:', err)
      throw err
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Hook to check if user has a specific role
 */
export function useAuthRole(requiredRole: string | string[]) {
  const { profile, loading } = useAuth()
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  
  if (loading) {
    return { hasRole: false, loading: true }
  }

  return {
    hasRole: profile ? roles.includes(profile.role) : false,
    loading: false,
  }
}

/**
 * Hook for admin-only routes - redirects if not admin
 */
export function useRequireAdmin() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role !== 'admin' && profile.role !== 'system_admin') {
        router.replace('/login')
      }
    }
  }, [profile, loading, router])

  return {
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'system_admin',
  }
}

/**
 * Hook for parent-only routes - redirects if not parent
 */
export function useRequireParent() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role !== 'parent') {
        router.replace('/login')
      }
    }
  }, [profile, loading, router])

  return {
    profile,
    loading,
    isParent: profile?.role === 'parent',
  }
}

/**
 * Hook for coach-only routes - redirects if not coach
 */
export function useRequireCoach() {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role !== 'coach') {
        router.replace('/login')
      }
    }
  }, [profile, loading, router])

  return {
    profile,
    loading,
    isCoach: profile?.role === 'coach',
  }
}


