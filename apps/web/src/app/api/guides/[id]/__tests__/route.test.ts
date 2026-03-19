import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a shared mock that will be returned by all calls
let mockSupabase: unknown

// Mock all dependencies at top level
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/schemas', () => ({
  UpdateGuideSchema: {
    parse: vi.fn((data) => {
      // Simulate Zod validation - allow partial updates
      return data
    }),
  },
}))

// Import after mocks are set up
import { GET, PATCH, DELETE } from '../route'

describe('GET /api/guides/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Create fresh mock for each test
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    }
  })

  it('should return 200 with guide and nested data using single query (N+1 fix)', async () => {
    // Mock the single nested query (N+1 fix verification)
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'guide-123',
        keyword: 'test keyword',
        language: 'fr',
        serp_analyses: [
          {
            id: 'analysis-1',
            keyword: 'test keyword',
            serp_pages: [
              { id: 'page-1', url: 'https://example.com', title: 'Example' },
              { id: 'page-2', url: 'https://example2.com', title: 'Example 2' },
            ],
            semantic_terms: [
              { id: 'term-1', term: 'seo', min_occurrences: 5, max_occurrences: 10 },
              { id: 'term-2', term: 'content', min_occurrences: 3, max_occurrences: 8 },
            ],
          },
        ],
      },
      error: null,
    })

    const params = Promise.resolve({ id: 'guide-123' })
    const request = new Request('http://localhost/api/guides/guide-123')
    const response = await GET(request, { params })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.guide.id).toBe('guide-123')
    expect(json.analysis).toBeDefined()
    expect(json.pages).toHaveLength(2)
    expect(json.terms).toHaveLength(2)

    // Verify N+1 fix: select() should be called only once for the nested query
    expect(mockSupabase.select).toHaveBeenCalledTimes(1)
    expect(mockSupabase.select).toHaveBeenCalledWith(expect.stringContaining('serp_analyses'))
  })

  it('should return 500 when guide not found', async () => {
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Guide not found' },
    })

    const params = Promise.resolve({ id: 'nonexistent' })
    const request = new Request('http://localhost/api/guides/nonexistent')
    const response = await GET(request, { params })

    expect(response.status).toBe(404)
  })
})

describe('PATCH /api/guides/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Create fresh mock for each test
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    }
  })

  it('should return 200 with updated guide when valid data provided', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'guide-123',
        keyword: 'updated keyword',
        language: 'en',
        updated_at: '2026-03-19T12:00:00Z',
      },
      error: null,
    })

    const params = Promise.resolve({ id: 'guide-123' })
    const request = new Request('http://localhost/api/guides/guide-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'updated keyword',
        language: 'en',
      }),
    })

    const response = await PATCH(request, { params })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.keyword).toBe('updated keyword')
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: 'updated keyword',
        language: 'en',
      })
    )
  })

  it('should return 500 when database update fails', async () => {
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Update failed' },
    })

    const params = Promise.resolve({ id: 'guide-123' })
    const request = new Request('http://localhost/api/guides/guide-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'updated keyword',
      }),
    })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(500)
  })
})

describe('DELETE /api/guides/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Create fresh mock for each test
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    }
  })

  it('should return 200 with success when guide deleted', async () => {
    mockSupabase.eq.mockResolvedValue({
      data: null,
      error: null,
    })

    const params = Promise.resolve({ id: 'guide-123' })
    const request = new Request('http://localhost/api/guides/guide-123', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('should return 500 when database delete fails', async () => {
    mockSupabase.eq.mockResolvedValue({
      data: null,
      error: { message: 'Delete failed' },
    })

    const params = Promise.resolve({ id: 'guide-123' })
    const request = new Request('http://localhost/api/guides/guide-123', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params })
    expect(response.status).toBe(500)
  })
})
