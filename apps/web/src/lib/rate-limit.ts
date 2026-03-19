import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client only if credentials are available
// This allows the app to run in development without Redis
let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = Redis.fromEnv()
}

// SERP Analysis rate limit: 5 analyses per hour (expensive operation)
// Using sliding window for better fairness
export const serpRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      analytics: true,
      prefix: 'serpmantic:serp',
    })
  : null

// General API rate limit: 100 requests per minute
// Protects against API abuse
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'serpmantic:api',
    })
  : null

// Helper to get user identifier for rate limiting
// Priority: User ID > IP Address > 'anonymous'
export function getUserIdentifier(request: Request): string {
  // Try to get IP address from headers (Vercel/Cloudflare compatible)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')

  const ip = forwardedFor?.split(',')[0] ?? realIp ?? cfConnectingIp ?? 'anonymous'

  return ip.trim()
}

// Rate limit response helper
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// Check rate limit and return standardized result
export async function checkRateLimit(
  rateLimiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  // If no Redis configured (development), allow all requests
  if (!rateLimiter) {
    return {
      success: true,
      limit: 999,
      remaining: 999,
      reset: Date.now() + 3600000,
    }
  }

  const result = await rateLimiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}
