import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AnalyzeRequestSchema } from '@/lib/schemas'
import { serpRateLimit, getUserIdentifier, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

/**
 * Async SERP Analysis endpoint
 * Creates a background job and triggers processing without blocking
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('SERP analysis job creation started', { requestId })

    // 1. Rate limiting check
    const identifier = getUserIdentifier(request)
    const rateLimitResult = await checkRateLimit(serpRateLimit, identifier)

    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded', {
        identifier,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
      })
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'You have exceeded the maximum number of SERP analyses per hour (5). Please try again later.',
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: new Date(rateLimitResult.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    // 2. Validate request body
    const body = await request.json()
    const validatedData = AnalyzeRequestSchema.parse(body)
    const { guideId } = validatedData

    const supabase = await createClient()

    // 3. Create job in database
    const { data: job, error: jobError } = await supabase
      .from('serp_jobs')
      .insert({
        guide_id: guideId,
        status: 'pending',
      })
      .select()
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Failed to create job', detail: jobError }, { status: 500 })
    }

    logger.info('SERP job created', {
      jobId: job.id,
      guideId,
      duration: Date.now() - startTime,
      requestId,
    })

    // 4. Trigger background processing (fire-and-forget)
    // Using fetch with no await to trigger processing without blocking
    const baseUrl = request.nextUrl.origin
    fetch(`${baseUrl}/api/serp/process-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(error => {
      logger.error('Failed to trigger background job', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })

    // 5. Return immediately with job ID
    return NextResponse.json(
      {
        jobId: job.id,
        status: 'pending',
        message: 'Analysis started in background',
      },
      {
        status: 202, // Accepted
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      }
    )
  } catch (error) {
    return handleApiError(error, {
      route: '/api/serp/analyze-v2',
      context: {},
    })
  } finally {
    logger.clearRequestId()
  }
}
