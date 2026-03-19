import { NextResponse } from 'next/server';
import { checkRedisHealth, getCacheStats } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: System health check
 *     description: Check the health status of the application and its dependencies (database, cache, etc.)
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded]
 *                   description: Overall system status
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, unhealthy]
 *                         latency:
 *                           type: number
 *                           description: Query latency in milliseconds
 *                     cache:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, unhealthy, disabled]
 *                         latency:
 *                           type: number
 *                           description: Ping latency in milliseconds
 *                         totalKeys:
 *                           type: number
 *                         hits:
 *                           type: number
 *                         misses:
 *                           type: number
 *       503:
 *         description: Service unavailable - one or more critical services are down
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 error:
 *                   type: string
 */
export async function GET() {
  try {
    // Check database health
    const dbStart = Date.now();
    const supabase = await createClient();
    const { error: dbError } = await supabase.from('guides').select('id').limit(1);
    const dbLatency = Date.now() - dbStart;

    // Check Redis health
    const redisHealth = await checkRedisHealth();
    const cacheStats = await getCacheStats();

    const status =
      (!dbError && redisHealth.status !== 'unhealthy') ? 'healthy' : 'degraded';

    const response = {
      status,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: {
          status: dbError ? 'unhealthy' : 'healthy',
          latency: dbLatency,
          error: dbError?.message,
        },
        cache: {
          status: redisHealth.status,
          latency: redisHealth.latency,
          totalKeys: cacheStats.totalKeys,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          error: redisHealth.error,
        },
      },
    };

    // Return 503 if any critical service is unhealthy
    if (dbError) {
      return NextResponse.json(response, { status: 503 });
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
