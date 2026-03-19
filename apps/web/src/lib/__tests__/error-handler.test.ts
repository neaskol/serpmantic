import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ZodError } from 'zod'
import { handleApiError, generateRequestId } from '../error-handler'

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    setRequestId: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    clearRequestId: vi.fn(),
  },
}))

describe('generateRequestId', () => {
  it('should generate unique request IDs', () => {
    const id1 = generateRequestId()
    const id2 = generateRequestId()
    
    expect(id1).toMatch(/^req_[a-zA-Z0-9_-]{10}$/)
    expect(id2).toMatch(/^req_[a-zA-Z0-9_-]{10}$/)
    expect(id1).not.toBe(id2)
  })
})

describe('handleApiError', () => {
  const errorContext = {
    route: '/api/test',
    context: { testKey: 'testValue' },
  }

  let originalEnv: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    originalEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('should handle ZodError and return 400 with details in development', async () => {
    process.env.NODE_ENV = 'development'
    
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        path: ['keyword'],
        message: 'Required',
        expected: 'string',
        received: 'undefined',
      },
    ])

    const response = handleApiError(zodError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Validation error')
    expect(json.message).toBe('Invalid request data')
    expect(json.requestId).toMatch(/^req_/)
    expect(json.details).toBeDefined()
    expect(json.details).toHaveLength(1)
  })

  it('should handle ZodError and hide details in production', async () => {
    process.env.NODE_ENV = 'production'
    
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        path: ['keyword'],
        message: 'Required',
        expected: 'string',
        received: 'undefined',
      },
    ])

    const response = handleApiError(zodError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.details).toBeUndefined()
  })

  it('should handle rate limit errors and return 429', async () => {
    const rateLimitError = new Error('Rate limit exceeded: Too many requests')

    const response = handleApiError(rateLimitError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(429)
    expect(json.error).toBe('Rate limit exceeded')
    expect(json.message).toContain('Rate limit exceeded')
  })

  it('should handle NLP service errors and return 502', async () => {
    const nlpError = new Error('NLP service unavailable')

    const response = handleApiError(nlpError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(json.error).toBe('External service error')
    expect(json.message).toContain('temporarily unavailable')
  })

  it('should handle SERP API errors and return 502', async () => {
    const serpError = new Error('SERP API failed to respond')

    const response = handleApiError(serpError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(json.error).toBe('External service error')
  })

  it('should handle fetch failed errors and return 502', async () => {
    const fetchError = new Error('fetch failed: connection refused')

    const response = handleApiError(fetchError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(json.error).toBe('External service error')
  })

  it('should handle ECONNREFUSED errors and return 502', async () => {
    const connError = new Error('ECONNREFUSED 127.0.0.1:8001')

    const response = handleApiError(connError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(json.error).toBe('External service error')
  })

  it('should handle not found errors and return 404', async () => {
    const notFoundError = new Error('Guide not found')

    const response = handleApiError(notFoundError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Not found')
    expect(json.message).toBe('Guide not found')
  })

  it('should handle generic errors and return 500', async () => {
    process.env.NODE_ENV = 'production'
    const genericError = new Error('Something went wrong')

    const response = handleApiError(genericError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Internal server error')
    expect(json.message).toBe('An unexpected error occurred. Please try again.')
    expect(json.details).toBeUndefined()
  })

  it('should include error details for generic errors in development', async () => {
    process.env.NODE_ENV = 'development'
    const genericError = new Error('Something went wrong')

    const response = handleApiError(genericError, errorContext)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.details).toBeDefined()
    expect(json.details.message).toBe('Something went wrong')
    expect(json.details.stack).toBeDefined()
  })
})
