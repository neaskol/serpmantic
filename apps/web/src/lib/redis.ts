import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Redis client for caching and performance optimization
 *
 * Configuration:
 * - REDIS_URL: Redis connection string (default: redis://localhost:6379)
 * - Supports both local development and production (Upstash, Redis Cloud, etc.)
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection pooling
 * - Error handling with fallback to no-cache mode
 * - Performance monitoring
 */

let redis: Redis | null = null;
let redisAvailable = false;

function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  // Allow running without Redis in development
  if (!redisUrl) {
    logger.warn('REDIS_URL not configured - running without cache');
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect when Redis is in READONLY mode
          return true;
        }
        return false;
      },
      lazyConnect: true, // Don't connect until first command
    });

    // Log connection events
    client.on('connect', () => {
      logger.info('Redis connected');
      redisAvailable = true;
    });

    client.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
      redisAvailable = false;
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
      redisAvailable = false;
    });

    client.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });

    return client;
  } catch (error) {
    logger.error('Failed to create Redis client', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get Redis client instance (singleton)
 * Returns null if Redis is not available - handle gracefully
 */
export function getRedisClient(): Redis | null {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
}

/**
 * Check if Redis is available and connected
 */
export function isRedisAvailable(): boolean {
  return redisAvailable && redis !== null;
}

/**
 * Cache helper: Get value from cache
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Redis GET error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Cache helper: Set value in cache with TTL
 * @param key Cache key
 * @param value Value to cache (will be JSON stringified)
 * @param ttlSeconds Time to live in seconds (default: 24 hours)
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = 24 * 60 * 60
): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;

  try {
    const serialized = JSON.stringify(value);
    await client.setex(key, ttlSeconds, serialized);
    return true;
  } catch (error) {
    logger.error('Redis SET error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Cache helper: Delete value from cache
 */
export async function deleteCached(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return false;

  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Redis DEL error', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Cache helper: Delete all keys matching pattern
 * Use with caution - can be slow on large datasets
 */
export async function deleteCachedPattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  if (!client || !redisAvailable) return 0;

  try {
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;

    await client.del(...keys);
    return keys.length;
  } catch (error) {
    logger.error('Redis DEL pattern error', {
      pattern,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  totalKeys: number;
  memoryUsed?: string;
  hits?: number;
  misses?: number;
}> {
  const client = getRedisClient();

  if (!client || !redisAvailable) {
    return {
      connected: false,
      totalKeys: 0,
    };
  }

  try {
    const info = await client.info('stats');
    const dbsize = await client.dbsize();

    // Parse info string for stats
    const statsMatch = info.match(/keyspace_hits:(\d+)/);
    const missesMatch = info.match(/keyspace_misses:(\d+)/);

    return {
      connected: true,
      totalKeys: dbsize,
      hits: statsMatch ? parseInt(statsMatch[1], 10) : undefined,
      misses: missesMatch ? parseInt(missesMatch[1], 10) : undefined,
    };
  } catch (error) {
    logger.error('Failed to get cache stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      connected: false,
      totalKeys: 0,
    };
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy' | 'disabled';
  latency?: number;
  error?: string;
}> {
  const client = getRedisClient();

  if (!client) {
    return { status: 'disabled' };
  }

  try {
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Gracefully close Redis connection
 * Call this on app shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    redisAvailable = false;
    logger.info('Redis connection closed');
  }
}
