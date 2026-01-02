import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } }
) {
  try {
    const { clubId } = params

    if (!clubId) {
      return NextResponse.json(
        { error: 'Club ID is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()
    
    const { data: club, error } = await supabaseAdmin
      .from('clubs')
      .select('slug')
      .eq('id', clubId)
      .single()

    if (error || !club) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ slug: club.slug })
  } catch (error) {
    console.error('Error fetching club slug:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
