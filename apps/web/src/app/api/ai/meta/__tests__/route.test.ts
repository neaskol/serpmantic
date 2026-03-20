import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAiResponse } from '@/test/mocks'

// Create shared mock
let mockSupabase: any

// Mock all dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/ai/executor', () => ({
  executePrompt: vi.fn(),
  estimateCost: vi.fn(() => 0.0005),
}))

vi.mock('@/lib/ai/router', () => ({
  getModelForTask: vi.fn(() => 'openai/gpt-4o-mini'),
}))

vi.mock('@/lib/ai/json-extractor', () => ({
  extractJSON: vi.fn((text: string) => JSON.parse(text)),
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
import { POST } from '../route'
import { executePrompt } from '@/lib/ai/executor'

describe('POST /api/ai/meta', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
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

    const request = new Request('http://localhost/api/ai/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        content: 'Test content for meta generation',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 500 when content is too short (Zod validation)', async () => {
    const request = new Request('http://localhost/api/ai/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        content: 'Too short',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500) // Zod error caught by handleApiError
  })

  it('should return meta suggestions with valid request', async () => {
    const mockSuggestions = {
      suggestions: [
        {
          title: 'Complete Guide to Test Keyword - Expert Tips 2026',
          description: 'Learn everything about test keyword with our comprehensive guide. Discover expert tips, best practices, and actionable strategies for success.',
        },
        {
          title: 'Test Keyword: Ultimate Guide for Beginners 2026',
          description: 'Master test keyword with our step-by-step guide. Perfect for beginners and experts alike. Start your journey today!',
        },
      ],
    }

    vi.mocked(executePrompt).mockResolvedValue(
      mockAiResponse(JSON.stringify(mockSuggestions)) as never
    )

    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertSpy

    const request = new Request('http://localhost/api/ai/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        content: 'This is a long enough content for meta generation testing purposes.',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.suggestions).toHaveLength(2)
    expect(json.suggestions[0].title).toContain('Test Keyword')
    expect(json.suggestions[0].description).toContain('test keyword')
  })

  it('should filter out suggestions with invalid character counts', async () => {
    const mockSuggestions = {
      suggestions: [
        {
          title: 'Valid Title Length Here for SEO',
          description: 'This is a valid description with proper length that meets all the requirements for SEO meta description character count standards.',
        },
        {
          title: 'Too short',
          description: 'Also too short',
        },
        {
          title: 'This title is way too long and exceeds the maximum character limit allowed for SEO titles in search engines',
          description: 'This description is also way too long and exceeds the maximum character limit allowed for SEO meta descriptions in search engine results pages which typically display only the first 158 characters and then gets truncated.',
        },
      ],
    }

    vi.mocked(executePrompt).mockImplementation(async (options) => {
      if (options.onFinish) {
        await options.onFinish({
          text: JSON.stringify(mockSuggestions),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          finishReason: 'stop',
        })
      }
      return mockAiResponse(JSON.stringify(mockSuggestions)) as never
    })

    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.from = vi.fn().mockReturnValue({
      insert: insertSpy,
    })

    const request = new Request('http://localhost/api/ai/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        content: 'Valid content for testing meta generation filtering logic.',
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    // Only the first suggestion should pass validation (title 30-70 chars, desc 80-200 chars)
    expect(response.status).toBe(200)
    expect(json.suggestions).toHaveLength(1)
    expect(json.suggestions[0].title).toBe('Valid Title Length Here for SEO')
  })

  it('should return 500 when AI returns invalid structure', async () => {
    vi.mocked(executePrompt).mockResolvedValue(
      mockAiResponse(JSON.stringify({ invalid: 'structure' })) as never
    )

    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertSpy

    const request = new Request('http://localhost/api/ai/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        content: 'Valid content for testing error handling.',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)

    const json = await response.json()
    expect(json.error).toContain('invalid response format')
  })

  it('should return 500 when all suggestions are filtered out', async () => {
    const mockSuggestions = {
      suggestions: [
        { title: 'Too short', description: 'Also too short' },
        { title: 'Short', description: 'Not long enough' },
      ],
    }

    vi.mocked(executePrompt).mockResolvedValue(
      mockAiResponse(JSON.stringify(mockSuggestions)) as never
    )

    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertSpy

    const request = new Request('http://localhost/api/ai/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        content: 'Valid content for testing filtering behavior.',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)

    const json = await response.json()
    expect(json.error).toContain('invalid meta tags')
  })

  it('should track AI request in database', async () => {
    vi.mocked(executePrompt).mockImplementation(async (options) => {
      if (options.onFinish) {
        await options.onFinish({
          text: JSON.stringify({
            suggestions: [
              {
                title: 'Valid Title for Meta Tag Testing',
                description: 'Valid description with proper length that meets SEO requirements for meta description character count.',
              },
            ],
          }),
          usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
          finishReason: 'stop',
        })
      }
      return mockAiResponse(
        JSON.stringify({
          suggestions: [
            {
              title: 'Valid Title for Meta Tag Testing',
              description: 'Valid description with proper length that meets SEO requirements for meta description character count.',
            },
          ],
        })
      ) as never
    })

    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertSpy

    const request = new Request('http://localhost/api/ai/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        content: 'Valid content for testing AI request tracking.',
      }),
    })

    await POST(request)

    // Verify ai_requests insert
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'test-user-id',
        guide_id: null,
        prompt_id: null,
        prompt_tokens: 200,
        completion_tokens: 100,
        total_tokens: 300,
      })
    )
  })
})
