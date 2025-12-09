'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User, Settings } from 'lucide-react'
import { Profile } from '@/lib/types'

interface ProfileMenuProps {
  profile: Profile
}

export function ProfileMenu({ profile }: ProfileMenuProps) {
  const router = useRouter()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url || null)
  const [initials, setInitials] = useState('')

  useEffect(() => {
    // Set initial avatar URL from profile prop
    if (profile.avatar_url) {
      setAvatarUrl(profile.avatar_url)
    } else {
      setAvatarUrl(null)
    }

    // Calculate initials
    const firstName = profile.first_name || ''
    const lastName = profile.last_name || ''
    const firstInitial = firstName.charAt(0).toUpperCase()
    const lastInitial = lastName.charAt(0).toUpperCase()
    setInitials(
      firstInitial && lastInitial
        ? `${firstInitial}${lastInitial}`
        : profile.email.charAt(0).toUpperCase()
    )

    // Load avatar URL from database (in case it was updated)
    async function loadAvatar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('avatar_url, first_name, last_name')
          .eq('id', user.id)
          .single()

        if (profileData?.avatar_url) {
          setAvatarUrl(profileData.avatar_url)
        } else {
          setAvatarUrl(null)
        }

        const firstName = profileData?.first_name || profile.first_name || ''
        const lastName = profileData?.last_name || profile.last_name || ''
        const firstInitial = firstName.charAt(0).toUpperCase()
        const lastInitial = lastName.charAt(0).toUpperCase()
        setInitials(
          firstInitial && lastInitial
            ? `${firstInitial}${lastInitial}`
            : profile.email.charAt(0).toUpperCase()
        )
      }
    }

    loadAvatar()
  }, [profile])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const displayName =
    profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile.first_name || profile.email

  // Determine the profile edit route based on role
  const getProfileEditRoute = () => {
    if (profile.role === 'admin' || profile.role === 'system_admin') {
      return '/admin/profile'
    } else if (profile.role === 'coach') {
      return '/coach/profile'
    } else if (profile.role === 'parent') {
      // For parents, we need the club slug from the current URL
      if (typeof window !== 'undefined') {
        const pathParts = window.location.pathname.split('/')
        const clubSlugIndex = pathParts.indexOf('clubs')
        if (clubSlugIndex !== -1 && pathParts[clubSlugIndex + 1]) {
          return `/clubs/${pathParts[clubSlugIndex + 1]}/parent/profile`
        }
      }
      return '/profile' // Fallback
    }
    return '/profile'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-1 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          <Avatar className="h-10 w-10">
            <AvatarImage 
              src={avatarUrl || undefined} 
              alt={displayName}
              className="object-cover"
              onError={() => {
                // If image fails to load, fall back to initials
                setAvatarUrl(null)
              }}
            />
            <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {profile.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={getProfileEditRoute()} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Edit Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
