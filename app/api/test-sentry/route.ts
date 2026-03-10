import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

/**
 * Test endpoint to verify Sentry error capture
 * Visit: http://localhost:3000/api/test-sentry?error=true
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const shouldError = searchParams.get('error')

  if (shouldError === 'true') {
    // Capture a test error
    const testError = new Error('🧪 Test error from Sentry test endpoint')
    Sentry.captureException(testError, {
      tags: {
        test: 'true',
        endpoint: '/api/test-sentry',
      },
      extra: {
        timestamp: new Date().toISOString(),
        message: 'This is a deliberate test error',
      },
    })

    // Also throw an unhandled error to test automatic capture
    throw new Error('🔥 Unhandled test error - Sentry should catch this!')
  }

  // Test performance transaction
  const transaction = Sentry.startTransaction({
    op: 'test',
    name: 'Test Sentry Transaction',
  })

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100))

  transaction.finish()

  return NextResponse.json({
    success: true,
    message: '✅ Sentry is configured!',
    instructions: 'Add ?error=true to test error capture',
    sentryEnabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  })
}
