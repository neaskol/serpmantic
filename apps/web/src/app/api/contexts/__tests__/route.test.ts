import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create shared mock
let mockSupabase: any

// Mock all dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/schemas', () => ({
  CreateContextSchema: {
    parse: vi.fn((data) => {
      // Simulate Zod validation
      if (!data.name || data.name.length === 0) {
        throw new Error('Name required')
      }
      if (data.name.length > 100) {
        throw new Error('Name too long')
      }
      return {
        name: data.name,
        audience: data.audience || '',
        tone: data.tone || '',
        sector: data.sector || '',
        brief: data.brief || '',
      }
    }),
  },
}))

vi.mock('@/lib/error-handler', () => ({
  handleApiError: vi.fn((error) => ({
    json: async () => ({ error: 'Internal error' }),
    status: 500,
  })),
  generateRequestId: vi.fn(() => 'test-request-id'),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setRequestId: vi.fn(),
    clearRequestId: vi.fn(),
  },
}))

// Import after mocks
import { GET, POST } from '../route'

describe('GET /api/contexts', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
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

  it('should return 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('should return list of contexts for authenticated user', async () => {
    mockSupabase.order.mockResolvedValue({
      data: [
        {
          id: 'ctx-1',
          name: 'Marketing Context',
          audience: 'B2B marketers',
          tone: 'professional',
          sector: 'SaaS',
          brief: 'Focus on ROI and conversion',
          created_at: '2026-03-19T10:00:00Z',
          updated_at: '2026-03-19T10:00:00Z',
        },
        {
          id: 'ctx-2',
          name: 'Editorial Context',
          audience: 'General public',
          tone: 'conversational',
          sector: 'Education',
          brief: 'Explain concepts simply',
          created_at: '2026-03-19T09:00:00Z',
          updated_at: '2026-03-19T09:00:00Z',
        },
      ],
      error: null,
    })

    const response = await GET()
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.contexts).toHaveLength(2)
    expect(json.contexts[0].name).toBe('Marketing Context')
    expect(json.contexts[0].audience).toBe('B2B marketers')
  })

  it('should return 500 when database query fails', async () => {
    mockSupabase.order.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    })

    const response = await GET()
    expect(response.status).toBe(500)

    const json = await response.json()
    expect(json.error).toBe('Failed to load contexts')
  })
})

describe('POST /api/contexts', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
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

  it('should return 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const request = new Request('http://localhost/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Context',
        audience: 'Developers',
        tone: 'technical',
        sector: 'Tech',
        brief: 'Technical documentation',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should create context and return 201 with valid data', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'ctx-123',
        name: 'Test Context',
        audience: 'Developers',
        tone: 'technical',
        sector: 'Tech',
        brief: 'Technical documentation',
        user_id: 'test-user-id',
        created_at: '2026-03-20T10:00:00Z',
        updated_at: '2026-03-20T10:00:00Z',
      },
      error: null,
    })

    const request = new Request('http://localhost/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Context',
        audience: 'Developers',
        tone: 'technical',
        sector: 'Tech',
        brief: 'Technical documentation',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)

    const json = await response.json()
    expect(json.context.id).toBe('ctx-123')
    expect(json.context.name).toBe('Test Context')
    expect(json.context.audience).toBe('Developers')
  })

  it('should handle missing optional fields with defaults', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'ctx-456',
        name: 'Minimal Context',
        audience: '',
        tone: '',
        sector: '',
        brief: '',
        user_id: 'test-user-id',
        created_at: '2026-03-20T10:00:00Z',
        updated_at: '2026-03-20T10:00:00Z',
      },
      error: null,
    })

    const request = new Request('http://localhost/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Minimal Context',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)

    const json = await response.json()
    expect(json.context.name).toBe('Minimal Context')
    expect(json.context.audience).toBe('')
    expect(json.context.tone).toBe('')
  })

  it('should return 500 when name is missing (Zod validation)', async () => {
    const request = new Request('http://localhost/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audience: 'Developers',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500) // Zod error caught by handleApiError
  })

  it('should return 500 when name is too long (Zod validation)', async () => {
    const request = new Request('http://localhost/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A'.repeat(101), // 101 characters, max is 100
        audience: 'Test',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })

  it('should return 500 when database insert fails', async () => {
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Database insert failed' },
    })

    const request = new Request('http://localhost/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Context',
        audience: 'Developers',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)

    const json = await response.json()
    expect(json.error).toBe('Failed to create context')
  })

  it('should include user_id when inserting context', async () => {
    const insertSpy = vi.fn().mockReturnThis()
    const selectSpy = vi.fn().mockReturnThis()
    const singleSpy = vi.fn().mockResolvedValue({
      data: {
        id: 'ctx-789',
        name: 'User Context',
        audience: 'Test',
        tone: 'casual',
        sector: 'Tech',
        brief: 'Test brief',
        user_id: 'test-user-id',
        created_at: '2026-03-20T10:00:00Z',
        updated_at: '2026-03-20T10:00:00Z',
      },
      error: null,
    })

    mockSupabase.insert = insertSpy
    mockSupabase.select = selectSpy
    mockSupabase.single = singleSpy

    const request = new Request('http://localhost/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User Context',
        audience: 'Test',
        tone: 'casual',
        sector: 'Tech',
        brief: 'Test brief',
      }),
    })

    await POST(request)

    // Verify user_id was included in insert
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'User Context',
        user_id: 'test-user-id',
      })
    )
  })
})
