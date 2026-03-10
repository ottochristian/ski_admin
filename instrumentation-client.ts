// This file configures the initialization of Sentry for the browser/client runtime
// Current pattern for Next.js 13+ with App Router
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Send user PII (IP, request headers)
  sendDefaultPii: true,

  // Performance Monitoring: 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Session Replay: 10% of all sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Enable Sentry Logs
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',

  integrations: [
    Sentry.replayIntegration({
      // Privacy: mask all text and block media
      maskAllText: true,
      blockAllMedia: true,
    }),
    // Optional: User feedback widget
    // Sentry.feedbackIntegration({ colorScheme: "system" }),
  ],

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Filter out non-critical errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    "Can't find variable: gtag",
    'Non-Error promise rejection captured',
    
    // Network errors
    'NetworkError',
    'Network request failed',
    'Failed to fetch',
    
    // Cancelled requests
    'AbortError',
    'The operation was aborted',
    
    // ResizeObserver
    'ResizeObserver loop limit exceeded',
  ],

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Filter out sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }

    // Filter out PII from context
    if (event.contexts?.user) {
      delete event.contexts.user.email
      delete event.contexts.user.ip_address
    }

    return event
  },
})

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
