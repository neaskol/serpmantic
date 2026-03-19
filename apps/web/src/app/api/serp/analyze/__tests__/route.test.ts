import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, mockFetch } from '@/test/mocks'

// Mock all dependencies at top level
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}))

vi.mock('@/lib/rate-limit', () => ({
  serpRateLimit: {},
  getUserIdentifier: vi.fn(() => 'test-user'),
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    limit: 5,
    remaining: 4,
    reset: Date.now() + 3600000,
  }),
}))

vi.mock('@/lib/cache', () => ({
  getCachedSerpAnalysis: vi.fn().mockResolvedValue(null),
  setCachedSerpAnalysis: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/serp', () => ({
  fetchSerpResults: vi.fn().mockResolvedValue([
    { link: 'https://example1.com', title: 'Example 1' },
    { link: 'https://example2.com', title: 'Example 2' },
  ]),
}))

vi.mock('@/lib/crawler', () => ({
  crawlPage: vi.fn().mockResolvedValue({
    url: 'https://example.com',
    title: 'Example',
    text: 'Test content',
    metrics: { words: 100, headings: 5, paragraphs: 10, links: 3, images: 2, videos: 0, tables: 0, lists: 1 },
  }),
}))

vi.mock('@/lib/scoring', () => ({
  calculateScore: vi.fn().mockReturnValue({
    score: 85,
    termStatuses: [
      { term: { term: 'seo' }, count: 5, status: 'ok' },
    ],
  }),
}))

// Import after mocks are set up
import { POST } from '../route'

describe('POST /api/serp/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 with valid analysis when all services respond', async () => {
    // Mock Supabase to return successful insert results
    const { createClient } = await import('@/lib/supabase/server')
    const mockSupabase = createMockSupabaseClient()

    // Configure delete to return success
    mockSupabase.delete.mockReturnThis()
    mockSupabase.eq.mockResolvedValue({ data: null, error: null })

    // Configure insert chain: insert().select().single()
    mockSupabase.insert.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'analysis-123', guide_id: '123e4567-e89b-12d3-a456-426614174000' },
      error: null,
    })

    // Mock successful NLP response
    mockFetch({
      terms: [
        { term: 'seo', minOccurrences: 5, maxOccurrences: 10, importance: 0.9 },
      ],
      termsToAvoid: ['spam'],
    })

    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveProperty('terms')
    expect(json).toHaveProperty('termsToAvoid')
  })

  it('should return 400 when keyword is missing', async () => {
    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Validation error')
  })

  it('should return 400 when language is invalid', async () => {
    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'invalid',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when searchEngine is not a URL', async () => {
    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'not-a-url',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when guideId is not a UUID', async () => {
    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: 'not-a-uuid',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 502 when NLP service is down', async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(502)

    const json = await response.json()
    expect(json.error).toBe('External service error')
  })
})
