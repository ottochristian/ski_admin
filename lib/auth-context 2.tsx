'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { Profile } from './types'

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
 * Unified authentication provider for the entire application
 * Handles user authentication, profile loading, and session management
 * Replaces duplicate auth logic across layouts and hooks
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadRef = useRef(true)

  // Load user and profile
  // showLoader: set to false when refreshing token (user already authenticated)
  const loadAuth = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true)
      }
      setError(null)

      // First check if we have a session (localStorage only, no network call)
      // This prevents "Auth session missing!" errors when user is not logged in
      const { data: { session } } = await supabase.auth.getSession()
      
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
      } = await supabase.auth.getUser()

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
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

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
      setError('An error occurred during authentication')
      setUser(null)
      setProfile(null)
      setLoading(false)
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
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
        setProfile(null)
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        // If this is the initial load, show the loader (first time sign in)
        // After initial load, this is a tab switch - silent refresh (no loader)
        await loadAuth(initialLoadRef.current)
      } else if (event === 'TOKEN_REFRESHED') {
        // Silent refresh on token refresh (no loader, user already authenticated)
        await loadAuth(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

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
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      router.push('/login')
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

