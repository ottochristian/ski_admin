import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Replicate the schemas from the send route to test them in isolation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const targetSchema = z.object({
  type: z.enum(['program', 'sub_program', 'group']),
  id: z.string().uuid(),
})

const sendSchema = z.object({
  clubSlug: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  targets: z.array(targetSchema).min(1, 'At least one target required'),
  season_id: z.string().uuid().optional(),
  additional_emails: z
    .array(z.string().regex(emailRegex, 'Invalid email'))
    .max(20, 'Max 20 additional recipients')
    .optional()
    .default([]),
})

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_TARGET = { type: 'program' as const, id: VALID_UUID }

describe('Messaging send schema', () => {
  describe('valid payloads', () => {
    it('accepts minimal valid payload', () => {
      const result = sendSchema.parse({
        clubSlug: 'test-club',
        subject: 'Hello',
        body: 'Message body',
        targets: [VALID_TARGET],
      })
      expect(result.targets).toHaveLength(1)
      expect(result.additional_emails).toEqual([])
    })

    it('accepts all target types', () => {
      const types = ['program', 'sub_program', 'group'] as const
      for (const type of types) {
        const result = sendSchema.parse({
          clubSlug: 'test-club',
          subject: 'Hello',
          body: 'Body',
          targets: [{ type, id: VALID_UUID }],
        })
        expect(result.targets[0].type).toBe(type)
      }
    })

    it('accepts multiple targets', () => {
      const result = sendSchema.parse({
        clubSlug: 'test-club',
        subject: 'Hello',
        body: 'Body',
        targets: [
          { type: 'sub_program', id: VALID_UUID },
          { type: 'sub_program', id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
        ],
      })
      expect(result.targets).toHaveLength(2)
    })

    it('accepts valid additional_emails', () => {
      const result = sendSchema.parse({
        clubSlug: 'test-club',
        subject: 'Hello',
        body: 'Body',
        targets: [VALID_TARGET],
        additional_emails: ['a@b.com', 'coach@club.org'],
      })
      expect(result.additional_emails).toEqual(['a@b.com', 'coach@club.org'])
    })

    it('accepts optional season_id', () => {
      const result = sendSchema.parse({
        clubSlug: 'test-club',
        subject: 'Hello',
        body: 'Body',
        targets: [VALID_TARGET],
        season_id: VALID_UUID,
      })
      expect(result.season_id).toBe(VALID_UUID)
    })
  })

  describe('invalid payloads', () => {
    it('rejects empty targets array', () => {
      expect(() =>
        sendSchema.parse({ clubSlug: 'x', subject: 'Hello', body: 'Body', targets: [] })
      ).toThrow()
    })

    it('rejects missing targets', () => {
      expect(() =>
        sendSchema.parse({ clubSlug: 'x', subject: 'Hello', body: 'Body' })
      ).toThrow()
    })

    it('rejects invalid target type', () => {
      expect(() =>
        sendSchema.parse({
          clubSlug: 'x', subject: 'Hello', body: 'Body',
          targets: [{ type: 'athlete', id: VALID_UUID }],
        })
      ).toThrow()
    })

    it('rejects non-UUID target id', () => {
      expect(() =>
        sendSchema.parse({
          clubSlug: 'x', subject: 'Hello', body: 'Body',
          targets: [{ type: 'program', id: 'not-a-uuid' }],
        })
      ).toThrow()
    })

    it('rejects empty subject', () => {
      expect(() =>
        sendSchema.parse({ clubSlug: 'x', subject: '', body: 'Body', targets: [VALID_TARGET] })
      ).toThrow()
    })

    it('rejects subject over 200 chars', () => {
      expect(() =>
        sendSchema.parse({
          clubSlug: 'x', subject: 'a'.repeat(201), body: 'Body', targets: [VALID_TARGET],
        })
      ).toThrow()
    })

    it('rejects empty body', () => {
      expect(() =>
        sendSchema.parse({ clubSlug: 'x', subject: 'Hello', body: '', targets: [VALID_TARGET] })
      ).toThrow()
    })

    it('rejects body over 10000 chars', () => {
      expect(() =>
        sendSchema.parse({
          clubSlug: 'x', subject: 'Hello', body: 'a'.repeat(10001), targets: [VALID_TARGET],
        })
      ).toThrow()
    })

    it('rejects malformed email in additional_emails', () => {
      expect(() =>
        sendSchema.parse({
          clubSlug: 'x', subject: 'Hello', body: 'Body', targets: [VALID_TARGET],
          additional_emails: ['not-an-email'],
        })
      ).toThrow()
    })

    it('rejects more than 20 additional_emails', () => {
      const emails = Array.from({ length: 21 }, (_, i) => `user${i}@example.com`)
      expect(() =>
        sendSchema.parse({
          clubSlug: 'x', subject: 'Hello', body: 'Body', targets: [VALID_TARGET],
          additional_emails: emails,
        })
      ).toThrow()
    })

    it('rejects non-UUID season_id', () => {
      expect(() =>
        sendSchema.parse({
          clubSlug: 'x', subject: 'Hello', body: 'Body', targets: [VALID_TARGET],
          season_id: 'not-a-uuid',
        })
      ).toThrow()
    })

    it('rejects empty clubSlug', () => {
      expect(() =>
        sendSchema.parse({ clubSlug: '', subject: 'Hello', body: 'Body', targets: [VALID_TARGET] })
      ).toThrow()
    })
  })
})
