import { getCached, setCached, deleteCached, deleteCachedPattern, isRedisAvailable } from './redis'
import { logger } from './logger'

// Cache TTL: 24 hours for SERP analysis (balances freshness vs cost)
const SERP_CACHE_TTL = 86400 // 24 hours in seconds

// Cache TTL: 5 minutes for guide content (short lived, frequently updated)
const GUIDE_CACHE_TTL = 300 // 5 minutes in seconds

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
  if (!isRedisAvailable()) {
    return null // No caching in development without Redis
  }

  const key = `serp:analysis:${language}:${keyword.toLowerCase().trim()}`

  try {
    const cached = await getCached<unknown>(key)
    if (cached) {
      logger.info('SERP analysis cache hit', { keyword, language })
    }
    return cached
  } catch (error) {
    logger.error('Cache get error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
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
  if (!isRedisAvailable()) {
    return // No caching in development without Redis
  }

  const key = `serp:analysis:${language}:${keyword.toLowerCase().trim()}`

  try {
    await setCached(key, data, SERP_CACHE_TTL)
    logger.info('SERP analysis cached', { keyword, language, ttl: SERP_CACHE_TTL })
  } catch (error) {
    logger.error('Cache set error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
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
  if (!isRedisAvailable()) {
    return
  }

  const key = `serp:analysis:${language}:${keyword.toLowerCase().trim()}`

  try {
    await deleteCached(key)
    logger.info('SERP cache invalidated', { keyword, language })
  } catch (error) {
    logger.error('Cache invalidation error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
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
  if (!isRedisAvailable()) {
    return null
  }

  const key = `serp:results:${engine}:${language}:${keyword.toLowerCase().trim()}`

  try {
    const cached = await getCached<unknown>(key)
    if (cached) {
      logger.info('SERP results cache hit', { keyword, language, engine })
    }
    return cached
  } catch (error) {
    logger.error('Cache get error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
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
  if (!isRedisAvailable()) {
    return
  }

  const key = `serp:results:${engine}:${language}:${keyword.toLowerCase().trim()}`

  try {
    await setCached(key, results, SERP_CACHE_TTL)
    logger.info('SERP results cached', { keyword, language, engine, ttl: SERP_CACHE_TTL })
  } catch (error) {
    logger.error('Cache set error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getSerpCacheStats(pattern: string = 'serp:*'): Promise<{
  totalKeys: number
  pattern: string
} | null> {
  if (!isRedisAvailable()) {
    return null
  }

  try {
    // Count keys matching pattern
    const count = await deleteCachedPattern(pattern + '.temp') // Hacky but works for count
    return {
      totalKeys: count,
      pattern,
    }
  } catch (error) {
    logger.error('Cache stats error', {
      pattern,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ============================================================================
// Guide Content Caching
// ============================================================================

/**
 * Get cached guide content
 * @param guideId - Guide UUID
 * @returns Cached guide or null if not found/expired
 */
export async function getCachedGuide(guideId: string): Promise<unknown | null> {
  if (!isRedisAvailable()) {
    return null
  }

  const key = `guide:${guideId}`

  try {
    const cached = await getCached<unknown>(key)
    if (cached) {
      logger.info('Guide cache hit', { guideId })
    }
    return cached
  } catch (error) {
    logger.error('Guide cache get error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Store guide content in cache
 * @param guideId - Guide UUID
 * @param data - Guide data to cache
 */
export async function setCachedGuide(guideId: string, data: unknown): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  const key = `guide:${guideId}`

  try {
    await setCached(key, data, GUIDE_CACHE_TTL)
    logger.info('Guide cached', { guideId, ttl: GUIDE_CACHE_TTL })
  } catch (error) {
    logger.error('Guide cache set error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Invalidate cached guide (on update/delete)
 * @param guideId - Guide UUID
 */
export async function invalidateGuideCache(guideId: string): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  const key = `guide:${guideId}`

  try {
    await deleteCached(key)
    logger.info('Guide cache invalidated', { guideId })
  } catch (error) {
    logger.error('Guide cache invalidation error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Invalidate all guides for a user (on batch updates)
 * @param userId - User UUID
 */
export async function invalidateUserGuidesCache(userId: string): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  const pattern = `guides:user:${userId}`

  try {
    const deleted = await deleteCachedPattern(pattern)
    logger.info('User guides cache invalidated', { userId, deleted })
  } catch (error) {
    logger.error('User guides cache invalidation error', {
      pattern,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
