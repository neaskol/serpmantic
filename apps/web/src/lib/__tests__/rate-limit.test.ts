import { describe, it, expect, vi } from 'vitest'
import { getUserIdentifier, checkRateLimit } from '../rate-limit'

describe('getUserIdentifier', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    })

    const identifier = getUserIdentifier(request)
    expect(identifier).toBe('192.168.1.1')
  })

  it('should extract IP from x-real-ip header when x-forwarded-for is missing', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-real-ip': '192.168.1.2',
      },
    })

    const identifier = getUserIdentifier(request)
    expect(identifier).toBe('192.168.1.2')
  })

  it('should extract IP from cf-connecting-ip header when others are missing', () => {
    const request = new Request('http://localhost', {
      headers: {
        'cf-connecting-ip': '192.168.1.3',
      },
    })

    const identifier = getUserIdentifier(request)
    expect(identifier).toBe('192.168.1.3')
  })

  it('should return "anonymous" when no IP headers are present', () => {
    const request = new Request('http://localhost')

    const identifier = getUserIdentifier(request)
    expect(identifier).toBe('anonymous')
  })

  it('should trim whitespace from IP address', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '  192.168.1.1  , 10.0.0.1',
      },
    })

    const identifier = getUserIdentifier(request)
    expect(identifier).toBe('192.168.1.1')
  })
})

describe('checkRateLimit', () => {
  it('should allow all requests when rate limiter is null (development)', async () => {
    const result = await checkRateLimit(null, 'test-identifier')

    expect(result.success).toBe(true)
    expect(result.limit).toBe(999)
    expect(result.remaining).toBe(999)
    expect(result.reset).toBeGreaterThan(Date.now())
  })

  it('should call rate limiter and return success result when under limit', async () => {
    const mockRateLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 3600000,
      }),
    } as unknown

    const result = await checkRateLimit(mockRateLimiter, 'test-user')

    expect(result.success).toBe(true)
    expect(result.limit).toBe(5)
    expect(result.remaining).toBe(4)
    expect(mockRateLimiter.limit).toHaveBeenCalledWith('test-user')
  })

  it('should call rate limiter and return failure result when limit exceeded', async () => {
    const mockRateLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        reset: Date.now() + 3600000,
      }),
    } as unknown

    const result = await checkRateLimit(mockRateLimiter, 'test-user')

    expect(result.success).toBe(false)
    expect(result.limit).toBe(5)
    expect(result.remaining).toBe(0)
  })
})
