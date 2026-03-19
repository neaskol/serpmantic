import { describe, it, expect } from 'vitest'
import { AnalyzeRequestSchema, CreateGuideSchema } from '../schemas'

describe('AnalyzeRequestSchema', () => {
  it('validates correct data', () => {
    const data = {
      keyword: 'test keyword',
      language: 'fr' as const,
      searchEngine: 'https://google.fr',
      guideId: '123e4567-e89b-12d3-a456-426614174000',
    }
    const result = AnalyzeRequestSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects invalid language', () => {
    const data = {
      keyword: 'test',
      language: 'invalid',
      searchEngine: 'https://google.fr',
      guideId: '123e4567-e89b-12d3-a456-426614174000',
    }
    const result = AnalyzeRequestSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects keyword > 200 chars', () => {
    const data = {
      keyword: 'a'.repeat(201),
      language: 'fr' as const,
      searchEngine: 'https://google.fr',
      guideId: '123e4567-e89b-12d3-a456-426614174000',
    }
    const result = AnalyzeRequestSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID', () => {
    const data = {
      keyword: 'test',
      language: 'fr' as const,
      searchEngine: 'https://google.fr',
      guideId: 'not-a-uuid',
    }
    const result = AnalyzeRequestSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
