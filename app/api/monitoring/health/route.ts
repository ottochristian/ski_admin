import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/api-auth'

/**
 * Enhanced Health Check Endpoint
 * Returns comprehensive system health status for monitoring dashboard
 * 
 * GET /api/monitoring/health
 * 
 * Requires: System admin authentication
 */
export async function GET(request: NextRequest) {
  // Require admin authentication
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { supabase, profile } = authResult

  // Only system admins can access monitoring
  if (profile.role !== 'system_admin') {
    return NextResponse.json(
      { error: 'Forbidden: System admin access required' },
      { status: 403 }
    )
  }

  const startTime = Date.now()
  const health: any = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    checks: {}
  }

  // 1. Database Health Check
  try {
    const dbStart = Date.now()
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .single()

    const responseTime = Date.now() - dbStart

    if (error && error.code !== 'PGRST116') {
      health.checks.database = {
        status: 'unhealthy',
        error: error.message,
        responseTime
      }
      health.overall = 'degraded'
    } else {
      health.checks.database = {
        status: 'healthy',
        responseTime,
        rlsActive: true
      }
    }
  } catch (error: any) {
    health.checks.database = {
      status: 'down',
      error: error.message
    }
    health.overall = 'down'
  }

  // 2. Stripe API Health Check
  try {
    const stripeStart = Date.now()
    
    // Check if Stripe key is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      health.checks.stripe = {
        status: 'not_configured',
        message: 'STRIPE_SECRET_KEY not set'
      }
    } else {
      // Try to fetch account info (lightweight check)
      const response = await fetch('https://api.stripe.com/v1/balance', {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
      })

      const responseTime = Date.now() - stripeStart

      if (response.ok) {
        health.checks.stripe = {
          status: 'connected',
          responseTime,
          mode: process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test'
        }
      } else {
        health.checks.stripe = {
          status: 'error',
          error: `HTTP ${response.status}`,
          responseTime
        }
        health.overall = 'degraded'
      }
    }
  } catch (error: any) {
    health.checks.stripe = {
      status: 'error',
      error: error.message
    }
    health.overall = 'degraded'
  }

  // 3. Email Service (SendGrid) Health Check
  try {
    if (!process.env.SENDGRID_API_KEY) {
      health.checks.email = {
        status: 'not_configured',
        message: 'SendGrid not configured',
        configured: false
      }
    } else {
      // Check recent email metrics from our metrics table
      const { data: recentEmails } = await supabase
        .from('application_metrics')
        .select('metric_name, metric_value, metadata')
        .in('metric_name', ['email.sent', 'email.failed'])
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      const sent = recentEmails?.filter(m => m.metric_name === 'email.sent').length || 0
      const failed = recentEmails?.filter(m => m.metric_name === 'email.failed').length || 0
      const total = sent + failed

      if (total === 0) {
        // Configured but not used yet
        health.checks.email = {
          status: 'ready',
          message: 'Configured, awaiting first email',
          configured: true
        }
      } else {
        const successRate = sent / total
        health.checks.email = {
          status: successRate > 0.9 ? 'healthy' : successRate > 0.7 ? 'degraded' : 'unhealthy',
          sent24h: sent,
          failed24h: failed,
          successRate: Math.round(successRate * 100),
          configured: true
        }

        if (successRate <= 0.9) {
          health.overall = successRate > 0.7 ? 'degraded' : 'degraded'
        }
      }
    }
  } catch (error: any) {
    health.checks.email = {
      status: 'unknown',
      error: error.message
    }
  }

  // 4. SMS Service (Twilio) Health Check
  try {
    if (!process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_ACCOUNT_SID) {
      health.checks.sms = {
        status: 'not_configured',
        message: 'Twilio not configured',
        configured: false
      }
    } else {
      // Check recent SMS metrics
      const { data: recentSMS } = await supabase
        .from('application_metrics')
        .select('metric_name, metric_value, metadata')
        .in('metric_name', ['sms.sent', 'sms.failed'])
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      const sent = recentSMS?.filter(m => m.metric_name === 'sms.sent').length || 0
      const failed = recentSMS?.filter(m => m.metric_name === 'sms.failed').length || 0
      const total = sent + failed

      if (total === 0) {
        // Configured but not used yet
        health.checks.sms = {
          status: 'ready',
          message: 'Configured, awaiting first SMS',
          configured: true
        }
      } else {
        const successRate = sent / (sent + failed)
        health.checks.sms = {
          status: successRate > 0.9 ? 'healthy' : 'degraded',
          sent24h: sent,
          failed24h: failed,
          configured: true
        }
      }
    }
  } catch (error: any) {
    health.checks.sms = {
      status: 'unknown',
      error: error.message
    }
  }

  // 5. Webhook Health Check
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      health.checks.webhooks = {
        status: 'not_configured',
        message: 'Stripe webhooks not configured',
        configured: false
      }
    } else {
      const { data: webhookMetrics } = await supabase
        .from('application_metrics')
        .select('metric_name, metadata')
        .in('metric_name', ['webhook.succeeded', 'webhook.failed'])
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      const succeeded = webhookMetrics?.filter(m => m.metric_name === 'webhook.succeeded').length || 0
      const failed = webhookMetrics?.filter(m => m.metric_name === 'webhook.failed').length || 0
      const total = succeeded + failed

      if (total === 0) {
        // Configured but not used yet
        health.checks.webhooks = {
          status: 'ready',
          message: 'Configured, awaiting first webhook',
          configured: true
        }
      } else {
        const successRate = succeeded / total
        health.checks.webhooks = {
          status: successRate > 0.95 ? 'healthy' : successRate > 0.8 ? 'degraded' : 'unhealthy',
          total24h: total,
          succeeded24h: succeeded,
          failed24h: failed,
          successRate: Math.round(successRate * 100),
          configured: true
        }
      }
    }
  } catch (error: any) {
    health.checks.webhooks = {
      status: 'unknown',
      error: error.message
    }
  }

  // 6. Error Rate Check (from Sentry metrics if available)
  try {
    const { data: errorMetrics } = await supabase
      .from('application_metrics')
      .select('metric_value')
      .eq('metric_name', 'error.occurred')
      .gte('recorded_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour

    const errorCount = errorMetrics?.length || 0

    health.checks.errors = {
      status: errorCount < 10 ? 'healthy' : errorCount < 50 ? 'warning' : 'critical',
      lastHour: errorCount,
      rate: `${errorCount}/hour`
    }

    if (errorCount >= 50) {
      health.overall = 'degraded'
    }
  } catch (error: any) {
    health.checks.errors = {
      status: 'unknown',
      error: error.message
    }
  }

  health.responseTime = Date.now() - startTime

  return NextResponse.json(health)
}
