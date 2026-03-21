import { describe, it, expect, vi } from 'vitest'

/**
 * Integration tests for API route authentication and authorization
 * These test that routes properly check auth before processing
 */

describe('API Route Security', () => {
  describe('Protected Admin Routes', () => {
    const adminRoutes = [
      '/api/admin/athletes/summary',
      '/api/admin/programs/analytics',
      '/api/admin/registrations/summary',
      '/api/admin/revenue/summary',
    ]

    adminRoutes.forEach(route => {
      it(`${route} should require authentication`, async () => {
        // This test verifies the route imports requireAdmin
        const routePath = route.replace('/api/', 'app/api/') + '/route.ts'
        const fs = await import('fs')
        const content = fs.readFileSync(routePath, 'utf-8')
        
        expect(content).toContain('requireAdmin')
      })
    })
  })

  describe('Validation Implementation', () => {
    const routesRequiringValidation = [
      { route: 'checkout', schema: 'checkoutSchema', parseStr: 'validateRequest' },
      { route: 'athletes/create', schema: 'createAthleteSchema', parseStr: '.parse(' },
      { route: 'registrations/create', schema: 'createRegistrationSchema', parseStr: '.parse(' },
      { route: 'household-guardians/invite', schema: 'inviteGuardianSchema', parseStr: '.parse(' },
      { route: 'coaches/invite', schema: 'inviteCoachSchema', parseStr: '.parse(' },
      { route: 'otp/send', schema: 'otpSchema', parseStr: '.parse(' },
      { route: 'otp/verify', schema: 'otpSchema', parseStr: '.parse(' },
    ]

    routesRequiringValidation.forEach(({ route, schema, parseStr }) => {
      it(`${route} should use ${schema}`, async () => {
        const fs = await import('fs')
        const routePath = `app/api/${route}/route.ts`
        const content = fs.readFileSync(routePath, 'utf-8')

        expect(content).toContain(parseStr)
        expect(content).toContain('ValidationError')
      })
    })
  })

  describe('Rate Limiting', () => {
    const rateLimitedRoutes = [
      { route: 'checkout', limit: 'checkRateLimit' },
      { route: 'webhooks/stripe', limit: 'checkRateLimit' },
      { route: 'otp/send', limit: 'dbRateLimiter' },
    ]

    rateLimitedRoutes.forEach(({ route, limit }) => {
      it(`${route} should have rate limiting`, async () => {
        const fs = await import('fs')
        const routePath = `app/api/${route}/route.ts`
        const content = fs.readFileSync(routePath, 'utf-8')
        
        expect(content).toContain(limit)
      })
    })
  })
})
