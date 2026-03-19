import { Redis } from '@upstash/redis'

// Initialize Redis client only if credentials are available
let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = Redis.fromEnv()
}

// Cache TTL: 24 hours for SERP analysis (balances freshness vs cost)
const SERP_CACHE_TTL = 86400 // 24 hours in seconds

/**
 * Get cached SERP analysis result
 * @param keyword - Search keyword
 * @param language - Language code (fr, en, etc.)
 * @returns Cached analysis or null if not found/expired
 */
export async function getCachedSerpAnalysis(
  keyword: string,
  language: string
): Promise<unknown | null> {
  if (!redis) {
    return null // No caching in development without Redis
  }

  const key = `serp:analysis:${language}:${keyword.toLowerCase().trim()}`

  try {
    const cached = await redis.get(key)
    return cached
  } catch (error) {
    console.error('Cache get error:', error)
    return null // Fail gracefully - cache miss is not critical
  }
}

/**
 * Store SERP analysis result in cache
 * @param keyword - Search keyword
 * @param language - Language code
 * @param data - Analysis result to cache
 */
export async function setCachedSerpAnalysis(
  keyword: string,
  language: string,
  data: unknown
): Promise<void> {
  if (!redis) {
    return // No caching in development without Redis
  }

  const key = `serp:analysis:${language}:${keyword.toLowerCase().trim()}`

  try {
    await redis.setex(key, SERP_CACHE_TTL, JSON.stringify(data))
  } catch (error) {
    console.error('Cache set error:', error)
    // Don't throw - cache failure shouldn't break the app
  }
}

/**
 * Invalidate cached SERP analysis (force refresh)
 * @param keyword - Search keyword
 * @param language - Language code
 */
export async function invalidateSerpCache(
  keyword: string,
  language: string
): Promise<void> {
  if (!redis) {
    return
  }

  const key = `serp:analysis:${language}:${keyword.toLowerCase().trim()}`

  try {
    await redis.del(key)
  } catch (error) {
    console.error('Cache invalidation error:', error)
  }
}

/**
 * Get cached raw SERP results (from search engine API)
 * Useful for caching expensive SERP API calls separately
 */
export async function getCachedSerpResults(
  keyword: string,
  language: string,
  engine: string
): Promise<unknown | null> {
  if (!redis) {
    return null
  }

  const key = `serp:results:${engine}:${language}:${keyword.toLowerCase().trim()}`

  try {
    const cached = await redis.get(key)
    return cached
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

/**
 * Store raw SERP results in cache
 */
export async function setCachedSerpResults(
  keyword: string,
  language: string,
  engine: string,
  results: unknown
): Promise<void> {
  if (!redis) {
    return
  }

  const key = `serp:results:${engine}:${language}:${keyword.toLowerCase().trim()}`

  try {
    await redis.setex(key, SERP_CACHE_TTL, JSON.stringify(results))
  } catch (error) {
    console.error('Cache set error:', error)
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(pattern: string = 'serp:*'): Promise<{
  totalKeys: number
  pattern: string
} | null> {
  if (!redis) {
    return null
  }

  try {
    // Note: SCAN is expensive, use sparingly
    const keys = await redis.keys(pattern)
    return {
      totalKeys: keys.length,
      pattern,
    }
  } catch (error) {
    console.error('Cache stats error:', error)
    return null
  }
}
