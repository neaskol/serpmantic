import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { logger } from './logger'
import { nanoid } from 'nanoid'

export interface ErrorContext {
  route: string
  context?: Record<string, unknown>
}

export interface ApiErrorResponse {
  error: string
  message: string
  requestId: string
  timestamp: string
  details?: unknown
}

export function generateRequestId(): string {
  return `req_${nanoid(10)}`
}

export function handleApiError(
  error: unknown,
  errorContext: ErrorContext
): NextResponse<ApiErrorResponse> {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  // Zod validation error
  if (error instanceof ZodError) {
    logger.warn('Validation error', {
      route: errorContext.route,
      errors: error.issues,
      context: errorContext.context,
    })

    return NextResponse.json(
      {
        error: 'Validation error',
        message: 'Invalid request data',
        requestId,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error.issues : undefined,
      },
      { status: 400 }
    )
  }

  // Custom error types
  if (error instanceof Error) {
    // Rate limit error
    if (error.message.includes('Rate limit exceeded')) {
      logger.warn('Rate limit exceeded', {
        route: errorContext.route,
        context: errorContext.context,
      })

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 429 }
      )
    }

    // External service errors
    if (
      error.message.includes('NLP service') ||
      error.message.includes('SERP') ||
      error.message.includes('fetch failed') ||
      error.message.includes('ECONNREFUSED')
    ) {
      logger.error('External service error', {
        route: errorContext.route,
        error: error.message,
        stack: error.stack,
        context: errorContext.context,
      })

      return NextResponse.json(
        {
          error: 'External service error',
          message: 'A required service is temporarily unavailable. Please try again later.',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 502 }
      )
    }

    // Not found errors
    if (error.message.toLowerCase().includes('not found')) {
      logger.info('Resource not found', {
        route: errorContext.route,
        context: errorContext.context,
      })

      return NextResponse.json(
        {
          error: 'Not found',
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }
  }

  // Generic internal error
  logger.error('Internal server error', {
    route: errorContext.route,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: errorContext.context,
  })

  return NextResponse.json(
    {
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again.',
      requestId,
      timestamp: new Date().toISOString(),
      details:
        process.env.NODE_ENV === 'development' && error instanceof Error
          ? { message: error.message, stack: error.stack }
          : undefined,
    },
    { status: 500 }
  )
}
