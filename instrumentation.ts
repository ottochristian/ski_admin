// This file is used to register server-side Sentry initialization
// Loads the appropriate config based on runtime (Node.js vs Edge)
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

import * as Sentry from '@sentry/nextjs'

export async function register() {
  // Load Node.js server config
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  // Load Edge runtime config
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Automatically captures all unhandled server-side request errors
// Requires @sentry/nextjs >= 8.28.0
export const onRequestError = Sentry.captureRequestError
