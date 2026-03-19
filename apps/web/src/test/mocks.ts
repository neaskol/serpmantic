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
    single: vi.fn(),
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
