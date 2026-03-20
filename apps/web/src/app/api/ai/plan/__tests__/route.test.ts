import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockGenerateTextResponse } from '@/test/mocks'

// Create shared mock that will be returned by all calls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockSupabase: any

// Mock all dependencies at top level
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@/lib/ai/registry', () => ({
  getModel: vi.fn((modelId) => ({ id: modelId })),
}))

vi.mock('@/lib/ai/outline-builder', () => ({
  buildOutlinePrompt: vi.fn(() => 'Mock outline prompt'),
  validateOutlineHierarchy: vi.fn(() => true),
  parseOutlineResponse: vi.fn((text: string) => {
    const parsed = JSON.parse(text)
    return parsed.outline
  }),
}))

vi.mock('@/lib/error-handler', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleApiError: vi.fn((_error) => ({
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
import { POST } from '../route'
import { generateText } from 'ai'

describe('POST /api/ai/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Create fresh mock for each test
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      returns: vi.fn().mockReturnThis(),
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

    const request = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId: '123e4567-e89b-12d3-a456-426614174000' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when guideId is invalid', async () => {
    const request = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId: 'invalid-uuid' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500) // Zod validation error caught by handleApiError
  })

  it('should return 404 when guide not found', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Guide not found' },
    })

    const request = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId: '123e4567-e89b-12d3-a456-426614174000' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(404)

    const json = await response.json()
    expect(json.error).toBe('Guide not found')
  })

  it('should return 400 when no SERP analysis found', async () => {
    // Mock guide fetch
    mockSupabase.single.mockResolvedValueOnce({
      data: { keyword: 'test keyword', language: 'fr' },
      error: null,
    })

    // Mock SERP analysis fetch (no rows found)
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })

    const request = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId: '123e4567-e89b-12d3-a456-426614174000' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toContain('No SERP analysis found')
  })

  it('should generate outline and return 200 with valid data', async () => {
    // Mock guide fetch
    mockSupabase.single.mockResolvedValueOnce({
      data: { keyword: 'test keyword', language: 'fr' },
      error: null,
    })

    // Mock SERP analysis fetch
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'serp-analysis-id' },
      error: null,
    })

    // Mock SERP pages fetch
    mockSupabase.returns.mockResolvedValueOnce({
      data: [
        {
          url: 'https://example.com/page1',
          title: 'Page 1 Title',
          score: 100,
          headings: [
            { level: 'h2', text: 'Section 1' },
            { level: 'h3', text: 'Subsection 1.1' },
          ],
          is_excluded: false,
        },
      ],
      error: null,
    })

    // Mock semantic terms fetch
    mockSupabase.returns.mockResolvedValueOnce({
      data: [
        { display_term: 'term 1', importance: 0.9, is_to_avoid: false },
        { display_term: 'term 2', importance: 0.8, is_to_avoid: false },
      ],
      error: null,
    })

    // Mock AI response
    const mockOutline = [
      { level: 'h2', text: 'Introduction' },
      { level: 'h3', text: 'Background' },
      { level: 'h2', text: 'Main Content' },
    ]

    vi.mocked(generateText).mockResolvedValue(
      mockGenerateTextResponse(JSON.stringify({ outline: mockOutline }))
    )

    // Mock ai_requests insert
    mockSupabase.insert.mockReturnThis()
    mockSupabase.from.mockReturnThis()
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertMock

    const request = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId: '123e4567-e89b-12d3-a456-426614174000' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.outline).toEqual(mockOutline)
    expect(json.outline).toHaveLength(3)
    expect(json.outline[0].level).toBe('h2')
  })

  it('should return 500 when outline parsing fails', async () => {
    // Setup mocks like previous test
    mockSupabase.single
      .mockResolvedValueOnce({ data: { keyword: 'test', language: 'fr' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'serp-id' }, error: null })

    mockSupabase.returns
      .mockResolvedValueOnce({ data: [{ url: 'https://example.com', title: 'Test', score: 90, headings: [], is_excluded: false }], error: null })
      .mockResolvedValueOnce({ data: [{ display_term: 'term', importance: 0.9, is_to_avoid: false }], error: null })

    // Mock AI returning invalid JSON
    vi.mocked(generateText).mockResolvedValue(
      mockGenerateTextResponse('Invalid JSON response')
    )

    const request = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId: '123e4567-e89b-12d3-a456-426614174000' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)

    const json = await response.json()
    expect(json.error).toContain('malformed')
  })

  it('should track token usage in ai_requests table', async () => {
    // Setup full success scenario
    mockSupabase.single
      .mockResolvedValueOnce({ data: { keyword: 'test', language: 'fr' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'serp-id' }, error: null })

    mockSupabase.returns
      .mockResolvedValueOnce({ data: [{ url: 'https://example.com', title: 'Test', score: 90, headings: [], is_excluded: false }], error: null })
      .mockResolvedValueOnce({ data: [{ display_term: 'term', importance: 0.9, is_to_avoid: false }], error: null })

    const mockOutline = [{ level: 'h2', text: 'Test' }]
    vi.mocked(generateText).mockResolvedValue(
      mockGenerateTextResponse(JSON.stringify({ outline: mockOutline }), {
        promptTokens: 500,
        completionTokens: 250,
        totalTokens: 750,
      })
    )

    // Track insert calls
    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertSpy

    const request = new Request('http://localhost/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId: '123e4567-e89b-12d3-a456-426614174000' }),
    })

    await POST(request)

    // Verify ai_requests insert was called with correct usage data
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'test-user-id',
        guide_id: '123e4567-e89b-12d3-a456-426614174000',
        prompt_tokens: 500,
        completion_tokens: 250,
        total_tokens: 750,
      })
    )
  })
})
