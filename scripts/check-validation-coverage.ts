#!/usr/bin/env tsx
/**
 * Check validation coverage across all API routes
 * Exits with code 1 if coverage is below threshold
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

interface RouteInfo {
  path: string
  hasJsonInput: boolean
  hasValidation: boolean
}

function findRouteFiles(dir: string, basePath = ''): RouteInfo[] {
  const routes: RouteInfo[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      routes.push(...findRouteFiles(fullPath, join(basePath, entry)))
    } else if (entry === 'route.ts') {
      const content = readFileSync(fullPath, 'utf-8')
      const hasJsonInput = content.includes('request.json()')
      const hasValidation =
        content.includes('.parse(') ||
        content.includes('.safeParse(') ||
        content.includes('validateRequest(') ||
        content.includes('ValidationError')

      routes.push({
        path: join(basePath, entry).replace(/^\//, ''),
        hasJsonInput,
        hasValidation,
      })
    }
  }

  return routes
}

function main() {
  console.log('🔍 Checking API Route Validation Coverage\n')

  const apiDir = join(process.cwd(), 'app', 'api')
  const allRoutes = findRouteFiles(apiDir)
  const routesWithInput = allRoutes.filter(r => r.hasJsonInput)
  const routesWithValidation = routesWithInput.filter(r => r.hasValidation)

  console.log(`📊 Statistics:`)
  console.log(`   Total API routes: ${allRoutes.length}`)
  console.log(`   Routes with JSON input: ${routesWithInput.length}`)
  console.log(`   Routes with validation: ${routesWithValidation.length}`)
  console.log(`   Coverage: ${Math.round((routesWithValidation.length / routesWithInput.length) * 100)}%\n`)

  // List routes without validation
  const missingValidation = routesWithInput.filter(r => !r.hasValidation)
  
  if (missingValidation.length > 0) {
    console.log('❌ Routes missing validation:')
    missingValidation.forEach(route => {
      console.log(`   - ${route.path}`)
    })
    console.log('')
  }

  // List validated routes
  if (routesWithValidation.length > 0) {
    console.log('✅ Routes with validation:')
    routesWithValidation.forEach(route => {
      console.log(`   - ${route.path}`)
    })
    console.log('')
  }

  // Set threshold (e.g., 100% required)
  const threshold = 100
  const coverage = Math.round((routesWithValidation.length / routesWithInput.length) * 100)

  if (coverage < threshold) {
    console.log(`❌ FAIL: Validation coverage ${coverage}% is below threshold ${threshold}%`)
    process.exit(1)
  } else {
    console.log(`✅ PASS: Validation coverage ${coverage}% meets threshold ${threshold}%`)
    process.exit(0)
  }
}

main()
