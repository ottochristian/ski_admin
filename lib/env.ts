/**
 * Environment variable validation
 * Call this at application startup to fail fast if required vars are missing
 */

export function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env.local or environment configuration.'
    )
  }

  // Validate URLs
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
    } catch {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL is not a valid URL'
      )
    }
  }

  // Validate APP_URL if provided
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_APP_URL)
    } catch {
      throw new Error(
        'NEXT_PUBLIC_APP_URL is not a valid URL'
      )
    }
  }
}

/**
 * Get environment variable with validation
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue

  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`)
  }

  return value
}

/**
 * Get optional environment variable
 */
export function getEnvOptional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue
}

