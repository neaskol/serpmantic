import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getRedisClient } from '@/lib/redis'

export async function GET() {
  const startTime = Date.now()
  const health: Record<string, unknown> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  }

  try {
    const redis = getRedisClient()
    if (redis) {
      const redisStart = Date.now()
      await redis.ping()
      health.redis = {
        status: 'connected',
        latency: Date.now() - redisStart,
      }
    } else {
      health.redis = {
        status: 'disabled',
      }
    }
  } catch (error) {
    health.redis = {
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    health.status = 'degraded'
  }

  try {
    const dbStart = Date.now()
    const supabase = await createSupabaseClient()
    const { error, count } = await supabase
      .from('guides')
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    health.database = {
      status: 'connected',
      latency: Date.now() - dbStart,
      totalGuides: count ?? 0,
    }
  } catch (error) {
    health.database = {
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    health.status = 'degraded'
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  health.ai = {
    anthropic: anthropicKey ? 'configured' : 'missing',
    openai: openaiKey ? 'configured' : 'missing',
  }

  if (!anthropicKey || !openaiKey) {
    health.status = 'degraded'
  }

  const serpApiKey = process.env.SERP_API_KEY

  health.serp = {
    status: serpApiKey ? 'configured' : 'missing',
  }

  if (!serpApiKey) {
    health.status = 'degraded'
  }

  health.responseTime = Date.now() - startTime

  health.node = {
    version: process.version,
    platform: process.platform,
    arch: process.arch,
  }

  health.memory = {
    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
  }

  const statusCode = health.status === 'healthy' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
