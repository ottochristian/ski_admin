import { createClient } from './supabase/client'

/**
 * Get the user's club from their profile
 */
export async function getUserClub() {
  try {
    const supabase = createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('club_id')
      .eq('id', user.id)
      .single()

    if (!profile?.club_id) return null

    const { data: club } = await supabase
      .from('clubs')
      .select('id, name, slug, logo_url, primary_color')
      .eq('id', profile.club_id)
      .single()

    return club
  } catch (error) {
    console.error('Error getting user club:', error)
    return null
  }
}

/**
 * Get club by slug
 */
export async function getClubBySlug(slug: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, slug, logo_url, primary_color')
    .eq('slug', slug)
    .single()

  if (error) {
    console.error('Error getting club by slug:', error)
    return null
  }

  return data
}

/**
 * Helper to add club_id filter to a Supabase query
 * Note: This must be called AFTER select() but the filter is applied correctly
 */
export function withClubFilter<T>(
  query: any,
  clubId: string | null | undefined
) {
  if (!clubId) {
    console.warn('withClubFilter: clubId is null/undefined')
    return query
  }
  // Apply the filter - Supabase handles the order correctly
  return query.eq('club_id', clubId)
}

