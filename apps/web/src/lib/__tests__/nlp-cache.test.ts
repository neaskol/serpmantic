import { describe, it, expect } from 'vitest'
import { hashUrl, NLP_CACHE_TTL_DAYS } from '../nlp-cache'

describe('nlp-cache', () => {
  describe('hashUrl', () => {
    it('returns consistent SHA-256 hex for a URL', async () => {
      const hash = await hashUrl('https://example.com/page')
      expect(hash).toMatch(/^[a-f0-9]{64}$/) // SHA-256 = 64 hex chars
    })

    it('returns same hash for same URL', async () => {
      const hash1 = await hashUrl('https://example.com/page')
      const hash2 = await hashUrl('https://example.com/page')
      expect(hash1).toBe(hash2)
    })

    it('normalizes URL before hashing (lowercase, trim)', async () => {
      const hash1 = await hashUrl('https://Example.COM/Page')
      const hash2 = await hashUrl('  https://example.com/page  ')
      expect(hash1).toBe(hash2)
    })

    it('returns different hashes for different URLs', async () => {
      const hash1 = await hashUrl('https://example.com/a')
      const hash2 = await hashUrl('https://example.com/b')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('NLP_CACHE_TTL_DAYS', () => {
    it('is 7 days', () => {
      expect(NLP_CACHE_TTL_DAYS).toBe(7)
    })
  })
})
