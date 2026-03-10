import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { validateEnv } from "./lib/env";

// Validate environment variables at build time
if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnv();
  } catch (error) {
    console.error('❌ Environment validation failed:');
    console.error(error instanceof Error ? error.message : error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing in development mode, but fix environment variables before deploying');
    }
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
        ],
      },
    ]
  },
};

// Wrap with Sentry config for error monitoring and source maps
export default withSentryConfig(nextConfig, {
  // Sentry organization and project
  org: "skiadmin-9z",
  project: "javascript-nextjs",

  // Source map upload auth token
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload wider set of client source files for better stack trace resolution
  widenClientFileUpload: true,

  // Create a proxy API route to bypass ad-blockers
  tunnelRoute: "/monitoring-tunnel",

  // Suppress non-CI output
  silent: !process.env.CI,

  // Hide source maps from generated client bundles (security)
  hideSourceMaps: true,

  // Disable telemetry
  telemetry: false,
});
