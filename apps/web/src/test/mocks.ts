import { vi } from 'vitest'

// Supabase mock factory
export function createMockSupabaseClient() {
  const mockClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
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
  return mockClient
}

// Rate limiter mock
export function createMockRateLimiter(shouldSucceed = true) {
  return {
    limit: vi.fn().mockResolvedValue({
      success: shouldSucceed,
      limit: 5,
      remaining: shouldSucceed ? 4 : 0,
      reset: Date.now() + 3600000,
    }),
  }
}

// Fetch mock helper
export function mockFetch(response: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  })
}

// AI SDK mock response factory
export function mockAiResponse(text: string, usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 }) {
  return {
    text: Promise.resolve(text),
    finishReason: 'stop',
    usage,
    toTextStreamResponse: vi.fn().mockReturnValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text))
          controller.close()
        },
      }),
    }),
  }
}

// generateText mock response factory (for non-streaming AI calls)
export function mockGenerateTextResponse(text: string, usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 }) {
  return {
    text,
    finishReason: 'stop',
    usage,
  }
}
