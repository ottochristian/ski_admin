import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

/**
 * Messaging route security and structure tests.
 * These verify that all messaging routes have the required auth guards,
 * proper schema validation, and club-scoping behaviour.
 */

const readRoute = (path: string) => readFileSync(`app/api/messages/${path}`, 'utf-8')

describe('Messaging API routes', () => {
  describe('Authentication guards', () => {
    const authGuardedRoutes = [
      'send/route.ts',
      'sent/route.ts',
      'inbox/route.ts',
      'unread-count/route.ts',
      'recipient-count/route.ts',
      'family-preview/route.ts',
    ]

    authGuardedRoutes.forEach((routeFile) => {
      it(`messages/${routeFile} uses requireAuth`, () => {
        const content = readRoute(routeFile)
        expect(content).toContain('requireAuth')
        // Auth result must be checked before processing
        expect(content).toContain('authResult instanceof NextResponse')
      })
    })
  })

  describe('Send route — schema and role enforcement', () => {
    it('uses Zod schema with .parse()', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain('sendSchema')
      expect(content).toContain('.parse(')
    })

    it('validates targets array', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain("z.array(targetSchema)")
    })

    it('validates target type as enum', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain("z.enum(['program', 'sub_program', 'group'])")
    })

    it('validates target id as UUID', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain("z.string().uuid()")
    })

    it('enforces coach/admin role check', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain("'coach', 'admin', 'system_admin'")
    })

    it('guards coach against sending to other clubs', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain("role === 'coach' && senderProfile.club_id !== club.id")
    })

    it('validates additional_emails max 20', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain('.max(20')
    })

    it('deduplicates additional_emails against registered recipients', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain('filter((e) => !registeredEmails.includes(e))')
    })

    it('stores season_id on the message', () => {
      const content = readRoute('send/route.ts')
      expect(content).toContain('season_id')
    })
  })

  describe('Sent route — role-based filtering', () => {
    it('coaches see only their own messages', () => {
      const content = readRoute('sent/route.ts')
      expect(content).toContain("role === 'coach'")
      expect(content).toContain('sender_id')
    })

    it('admins see all club messages', () => {
      const content = readRoute('sent/route.ts')
      expect(content).toContain("'coach', 'admin', 'system_admin'")
    })

    it('filters by seasonId when provided', () => {
      const content = readRoute('sent/route.ts')
      expect(content).toContain('seasonId')
      expect(content).toContain('season_id')
    })

    it('attaches recipient_count to each message', () => {
      const content = readRoute('sent/route.ts')
      expect(content).toContain('recipient_count')
      expect(content).toContain('message_recipients')
    })
  })

  describe('Recipient-count route', () => {
    it('validates target_type and target_id params', () => {
      const content = readRoute('recipient-count/route.ts')
      expect(content).toContain('target_type')
      expect(content).toContain('target_id')
      expect(content).toContain('status: 400')
    })

    it('handles all three target types', () => {
      const content = readRoute('recipient-count/route.ts')
      expect(content).toContain("'group'")
      expect(content).toContain("'sub_program'")
      // program is the else/default case
      expect(content).toContain('program_id')
    })
  })

  describe('Family-preview route', () => {
    it('returns household last names (family names)', () => {
      const content = readRoute('family-preview/route.ts')
      expect(content).toContain('last_name')
      expect(content).toContain('families')
    })
  })
})

describe('Coach portal club-scoping', () => {
  it('CoachSidebar requires clubSlug prop (not optional)', () => {
    const content = readFileSync('components/coach-sidebar.tsx', 'utf-8')
    // clubSlug must be a required string prop (no ? or undefined)
    expect(content).toContain('clubSlug: string')
    expect(content).not.toContain('clubSlug?: string')
  })

  it('CoachSidebar builds basePath from clubSlug', () => {
    const content = readFileSync('components/coach-sidebar.tsx', 'utf-8')
    expect(content).toContain('`/clubs/${clubSlug}/coach`')
  })

  it('CoachSidebar includes Messages nav link', () => {
    const content = readFileSync('components/coach-sidebar.tsx', 'utf-8')
    expect(content).toContain('Messages')
    expect(content).toContain('messages')
  })

  it('coach compose page loads programs scoped to assigned coach', () => {
    const content = readFileSync(
      'app/clubs/[clubSlug]/coach/messages/compose/page.tsx', 'utf-8'
    )
    // Must look up coach_assignments to scope programs
    expect(content).toContain('coach_assignments')
    expect(content).toContain('coach_id')
  })

  it('coach compose page uses multi-target targets array', () => {
    const content = readFileSync(
      'app/clubs/[clubSlug]/coach/messages/compose/page.tsx', 'utf-8'
    )
    expect(content).toContain("targets")
    expect(content).toContain("household_ids")
  })

  it('admin compose page loads all club programs (no assignment filter)', () => {
    const content = readFileSync(
      'app/clubs/[clubSlug]/admin/messages/compose/page.tsx', 'utf-8'
    )
    // Admin loads from programs table filtered by club, not coach_assignments
    expect(content).toContain("from('programs')")
    expect(content).not.toContain('coach_assignments')
  })
})
