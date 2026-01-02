/**
 * Service Client Helper
 * 
 * Provides the appropriate Supabase client for services based on environment.
 * 
 * ARCHITECTURE:
 * - Browser: Uses SSR client (cookies, proper session management)
 * - Server: Falls back to legacy client (for backwards compatibility in hooks/server-side code)
 * 
 * Services can be instantiated in two ways:
 * 1. Use singleton export (uses default client):
 *    ```ts
 *    import { programsService } from '@/lib/services/programs-service'
 *    programsService.getAll()
 *    ```
 * 
 * 2. Create new instance with specific client (for API routes):
 *    ```ts
 *    import { ProgramsService } from '@/lib/services/programs-service'
 *    import { createAdminClient } from '@/lib/supabase/server'
 *    
 *    const admin = createAdminClient()
 *    const service = new ProgramsService(admin)
 *    ```
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Get the default Supabase client for services
 * Uses SSR client in browser, legacy client on server
 */
export function getServiceClient(): SupabaseClient {
  // In browser: use SSR client
  if (typeof window !== 'undefined') {
    const { createClient } = require('../supabase/client')
    return createClient()
  }
  
  // On server: use legacy client (for backwards compatibility)
  const { supabase } = require('../supabaseClient')
  return supabase
}
