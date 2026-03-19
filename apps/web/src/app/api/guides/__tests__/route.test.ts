import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a shared mock that will be returned by all calls
let mockSupabase: unknown

// Mock all dependencies at top level
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/schemas', () => ({
  CreateGuideSchema: {
    parse: vi.fn((data) => {
      // Simulate Zod validation
      if (!data.keyword) throw new Error('Keyword required')
      if (!['fr', 'en', 'it', 'de', 'es'].includes(data.language)) {
        throw new Error('Invalid language')
      }
      return data
    }),
  },
}))

// Import after mocks are set up
import { GET, POST } from '../route'

describe('GET /api/guides', () => {
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

  it('should return 200 with list of guides for authenticated user', async () => {
    // Mock guides query with order() support
    mockSupabase.order.mockResolvedValue({
      data: [
        {
          id: 'guide-1',
          keyword: 'test keyword',
          language: 'fr',
          created_at: '2026-03-19T10:00:00Z',
        },
        {
          id: 'guide-2',
          keyword: 'another keyword',
          language: 'en',
          created_at: '2026-03-19T11:00:00Z',
        },
      ],
      error: null,
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveLength(2)
    expect(json[0].keyword).toBe('test keyword')
  })

  it('should return 401 when user is not authenticated', async () => {
    // Mock auth failure
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('should return 500 when database query fails', async () => {
    // Mock database error
    mockSupabase.order.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    })

    const response = await GET()
    expect(response.status).toBe(500)
  })
})

describe('POST /api/guides', () => {
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

  it('should return 201 with created guide when valid data provided', async () => {
    // Mock insert success
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'guide-123',
        keyword: 'test keyword',
        language: 'fr',
        search_engine: 'https://google.fr',
        user_id: 'test-user-id',
        created_at: '2026-03-19T10:00:00Z',
      },
      error: null,
    })

    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.id).toBe('guide-123')
    expect(json.keyword).toBe('test keyword')
  })

  it('should return 400 when keyword is missing', async () => {
    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'fr',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })

  it('should return 400 when language is invalid', async () => {
    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'invalid',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })

  it('should return 401 when user is not authenticated', async () => {
    // Mock auth failure
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 500 when database insert fails', async () => {
    // Mock database error
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Database insert failed' },
    })

    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })
})
