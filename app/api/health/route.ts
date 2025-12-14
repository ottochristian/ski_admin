import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Health check endpoint for monitoring and load balancers.
 * Returns 200 if the service is healthy, 503 if unhealthy.
 */
export async function GET() {
  const checks: {
    timestamp: string
    status: 'healthy' | 'unhealthy'
    checks: {
      api: 'healthy' | 'unhealthy'
      database: 'healthy' | 'unhealthy' | 'unknown'
    }
  } = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      api: 'healthy',
      database: 'unknown',
    },
  }

  try {
    // Check database connectivity
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('clubs').select('id').limit(1)

    if (error) {
      checks.status = 'unhealthy'
      checks.checks.database = 'unhealthy'
      return NextResponse.json(checks, { status: 503 })
    }

    checks.checks.database = 'healthy'
  } catch (error) {
    checks.status = 'unhealthy'
    checks.checks.database = 'unhealthy'
    return NextResponse.json(checks, { status: 503 })
  }

  return NextResponse.json(checks, { status: 200 })
}



