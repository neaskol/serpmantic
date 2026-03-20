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
  estimateCost: vi.fn(() => 0.001),
}))

vi.mock('@/lib/ai/router', () => ({
  getModelForTask: vi.fn(() => 'anthropic/claude-sonnet-4-20250514'),
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

describe('POST /api/ai/intention', () => {
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

    const request = new Request('http://localhost/api/ai/intention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        serpPages: [
          { url: 'https://example.com', title: 'Test' },
          { url: 'https://example2.com', title: 'Test 2' },
          { url: 'https://example3.com', title: 'Test 3' },
        ],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 500 when serpPages has less than 3 pages (Zod validation)', async () => {
    const request = new Request('http://localhost/api/ai/intention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        serpPages: [
          { url: 'https://example.com', title: 'Test' },
          { url: 'https://example2.com', title: 'Test 2' },
        ],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500) // Zod error caught by handleApiError
  })

  it('should return intent classification with valid request', async () => {
    const mockIntentResponse = {
      primaryIntent: 'informationnel',
      confidence: 85,
      intents: [
        {
          type: 'informationnel',
          percentage: 70,
          description: 'Users want to understand the topic',
          questions: ['What is X?', 'How does X work?'],
        },
        {
          type: 'transactionnel',
          percentage: 30,
          description: 'Users want to purchase',
          questions: ['Where to buy X?', 'Best price for X?'],
        },
      ],
    }

    vi.mocked(executePrompt).mockResolvedValue(
      mockAiResponse(JSON.stringify(mockIntentResponse)) as never
    )

    // Mock insert
    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertSpy

    const request = new Request('http://localhost/api/ai/intention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        serpPages: [
          { url: 'https://example.com/1', title: 'Page 1' },
          { url: 'https://example.com/2', title: 'Page 2' },
          { url: 'https://example.com/3', title: 'Page 3' },
        ],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.primaryIntent).toBe('informationnel')
    expect(json.confidence).toBe(85)
    expect(json.intents).toHaveLength(2)
  })

  it('should call executePrompt with correct parameters', async () => {
    vi.mocked(executePrompt).mockResolvedValue(
      mockAiResponse(JSON.stringify({ primaryIntent: 'informationnel', confidence: 80, intents: [] })) as never
    )

    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertSpy

    const request = new Request('http://localhost/api/ai/intention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'delegataire cee',
        language: 'fr',
        serpPages: [
          { url: 'https://example.com/1', title: 'CEE Delegation Guide' },
          { url: 'https://example.com/2', title: 'Energy Certificates' },
          { url: 'https://example.com/3', title: 'Become a Delegatee' },
        ],
      }),
    })

    await POST(request)

    expect(executePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'anthropic/claude-sonnet-4-20250514',
        prompt: expect.stringContaining('delegataire cee'),
        systemPrompt: expect.stringContaining('SEO analyst'),
      })
    )

    // Verify SERP context was built
    const callArgs = vi.mocked(executePrompt).mock.calls[0][0]
    expect(callArgs.prompt).toContain('CEE Delegation Guide')
    expect(callArgs.prompt).toContain('https://example.com/1')
  })

  it('should track AI request in database', async () => {
    vi.mocked(executePrompt).mockImplementation(async (options) => {
      // Simulate onFinish callback
      if (options.onFinish) {
        await options.onFinish({
          text: JSON.stringify({ primaryIntent: 'informationnel', confidence: 80, intents: [] }),
          usage: { promptTokens: 300, completionTokens: 150, totalTokens: 450 },
          finishReason: 'stop',
        })
      }
      return mockAiResponse(JSON.stringify({ primaryIntent: 'informationnel', confidence: 80, intents: [] })) as never
    })

    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    mockSupabase.insert = insertSpy

    const request = new Request('http://localhost/api/ai/intention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        serpPages: [
          { url: 'https://example.com/1', title: 'Page 1' },
          { url: 'https://example.com/2', title: 'Page 2' },
          { url: 'https://example.com/3', title: 'Page 3' },
        ],
      }),
    })

    await POST(request)

    // Verify ai_requests insert
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'test-user-id',
        guide_id: null,
        prompt_id: null,
        prompt_tokens: 300,
        completion_tokens: 150,
        total_tokens: 450,
      })
    )
  })
})
