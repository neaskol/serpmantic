# Lightweight Monitoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement production-ready error handling and observability using structured logging and React Error Boundaries without external monitoring services.

**Architecture:** Create a structured logger utility for JSON-formatted logs, standardized API error handler with automatic classification, and React Error Boundaries for UI error catching. Integrate logging throughout SERP analysis pipeline and API routes.

**Tech Stack:** TypeScript, Next.js 15, React 19, Node.js built-ins (no external dependencies)

---

## Task 1: Create Structured Logger

**Files:**
- Create: `apps/web/src/lib/logger.ts`

**Step 1: Create logger file with types and base structure**

Create `apps/web/src/lib/logger.ts`:

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  environment: string
  hostname?: string
  requestId?: string
  [key: string]: unknown
}

class Logger {
  private isDevelopment: boolean
  private currentRequestId?: string

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  setRequestId(requestId: string) {
    this.currentRequestId = requestId
  }

  clearRequestId() {
    this.currentRequestId = undefined
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: process.env.NODE_ENV || 'development',
      ...context,
    }

    if (this.currentRequestId) {
      entry.requestId = this.currentRequestId
    }

    return this.sanitize(entry)
  }

  private sanitize(entry: LogEntry): LogEntry {
    // Remove sensitive fields
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'apikey']
    const sanitized = { ...entry }

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]'
      }
    }

    return sanitized
  }

  private output(entry: LogEntry) {
    if (this.isDevelopment) {
      this.prettyPrint(entry)
    } else {
      console.log(JSON.stringify(entry))
    }
  }

  private prettyPrint(entry: LogEntry) {
    const colors = {
      debug: '\x1b[36m',   // Cyan
      info: '\x1b[32m',    // Green
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m',
    }

    const time = new Date(entry.timestamp).toLocaleTimeString()
    const level = entry.level.toUpperCase()
    const color = colors[entry.level]

    console.log(`${color}[${time}] ${level}${colors.reset} ${entry.message}`)

    const context = { ...entry }
    delete context.timestamp
    delete context.level
    delete context.message
    delete context.environment

    if (Object.keys(context).length > 0) {
      console.log('  Context:', context)
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      const entry = this.formatEntry('debug', message, context)
      this.output(entry)
    }
  }

  info(message: string, context?: LogContext) {
    const entry = this.formatEntry('info', message, context)
    this.output(entry)
  }

  warn(message: string, context?: LogContext) {
    const entry = this.formatEntry('warn', message, context)
    this.output(entry)
  }

  error(message: string, context?: LogContext) {
    const entry = this.formatEntry('error', message, context)
    this.output(entry)
  }
}

export const logger = new Logger()
```

**Step 2: Test logger manually in development**

Create a test file `apps/web/src/lib/__test-logger.ts` (temporary):

```typescript
import { logger } from './logger'

logger.info('Test info message', { test: true })
logger.warn('Test warning', { reason: 'testing' })
logger.error('Test error', { error: 'something failed' })
logger.debug('Test debug', { data: { nested: 'value' } })

// Test sensitive data redaction
logger.info('Auth attempt', {
  username: 'test',
  password: 'secret123',
  apiKey: 'sk_test_123'
})
```

Run: `cd apps/web && npx tsx src/lib/__test-logger.ts`

Expected: Colored logs in terminal with timestamp, redacted sensitive fields

**Step 3: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 4: Delete test file**

Run: `rm apps/web/src/lib/__test-logger.ts`

**Step 5: Commit**

```bash
git add apps/web/src/lib/logger.ts
git commit -m "feat: add structured logger utility

- JSON logging in production, colorized in development
- Request ID tracking
- Sensitive data sanitization
- Type-safe log context

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create API Error Handler

**Files:**
- Create: `apps/web/src/lib/error-handler.ts`

**Step 1: Install nanoid for request ID generation**

Run: `cd apps/web && pnpm add nanoid`

Expected: Package installed successfully

**Step 2: Create error handler file**

Create `apps/web/src/lib/error-handler.ts`:

```typescript
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
      errors: error.errors,
      context: errorContext.context,
    })

    return NextResponse.json(
      {
        error: 'Validation error',
        message: 'Invalid request data',
        requestId,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error.errors : undefined,
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
```

**Step 3: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add apps/web/src/lib/error-handler.ts apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat: add API error handler

- Automatic error classification (validation, rate limit, external, internal)
- Request ID generation and tracking
- Structured error logging
- Environment-aware error responses

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create React Error Boundary

**Files:**
- Create: `apps/web/src/components/error-boundary.tsx`

**Step 1: Create error boundary component**

Create `apps/web/src/components/error-boundary.tsx`:

```typescript
'use client'

import { Component, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console with structure
    logger.error('React component error caught', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. The error has been logged. Please try again.
              </p>

              {/* Show error details in development only */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-xs bg-muted p-2 rounded">
                  <summary className="cursor-pointer font-medium mb-2">
                    Error Details (Dev Only)
                  </summary>
                  <pre className="overflow-auto whitespace-pre-wrap">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              <Button onClick={this.handleReset} className="w-full">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx
git commit -m "feat: add React Error Boundary component

- Catches React rendering errors
- User-friendly fallback UI
- Retry functionality
- Dev-mode error details
- Structured error logging

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Integrate Error Handler into SERP Analysis Route

**Files:**
- Modify: `apps/web/src/app/api/serp/analyze/route.ts`

**Step 1: Add imports and request ID tracking**

At the top of `apps/web/src/app/api/serp/analyze/route.ts`, add imports:

```typescript
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
```

**Step 2: Replace existing error handling with new handler**

Find the main `POST` function and wrap the entire try-catch block. Replace the existing catch block:

```typescript
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('SERP analysis started', { requestId })

    // 1. Rate limiting check (existing code)
    const identifier = getUserIdentifier(request)
    const rateLimitResult = await checkRateLimit(serpRateLimit, identifier)

    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded', {
        identifier,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining
      })
      // Keep existing rate limit response
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

    // 2. Validate request body (existing code)
    const body = await request.json()
    const validatedData = AnalyzeRequestSchema.parse(body)

    const { keyword, language, searchEngine, guideId } = validatedData

    // 3. Check cache (existing code)
    const cached = await getCachedSerpAnalysis(keyword, language)
    if (cached) {
      logger.info('Cache hit', {
        keyword,
        language,
        requestId,
        duration: Date.now() - startTime
      })
      return NextResponse.json(cached)
    }

    logger.info('Cache miss', { keyword, language, requestId })

    // 4. Fetch SERP results (add logging)
    logger.info('Fetching SERP results', { keyword, engine: searchEngine })
    const serpResults = await fetchSerpResults(keyword, searchEngine)
    logger.info('SERP results fetched', { numResults: serpResults.length })

    // 5. Crawl pages (add logging)
    logger.info('Crawling SERP pages', { numPages: serpResults.length })
    const crawledPages: CrawledPage[] = []

    for (const result of serpResults) {
      try {
        const page = await crawlPage(result.url)
        crawledPages.push(page)
      } catch (error) {
        logger.warn('Failed to crawl page', {
          url: result.url,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    logger.info('Pages crawled', {
      successful: crawledPages.length,
      total: serpResults.length
    })

    // 6. Call NLP service (add logging)
    logger.info('Calling NLP service', {
      language,
      numPages: crawledPages.length
    })

    const nlpStartTime = Date.now()
    const nlpResponse = await fetch(process.env.NLP_SERVICE_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: crawledPages.map((p) => p.text),
        language,
      }),
    })

    if (!nlpResponse.ok) {
      throw new Error(`NLP service returned ${nlpResponse.status}`)
    }

    const nlpData = await nlpResponse.json()
    logger.info('NLP analysis completed', {
      termsFound: nlpData.terms?.length || 0,
      termsToAvoid: nlpData.terms_to_avoid?.length || 0,
      duration: Date.now() - nlpStartTime,
    })

    // ... rest of existing code (saving to DB, etc.)

    // Cache the result (add logging)
    await setCachedSerpAnalysis(keyword, language, result)
    logger.info('Results cached', { keyword, language, ttl: 86400 })

    logger.info('SERP analysis completed', {
      keyword,
      language,
      score: result.score || 0,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(result)
  } catch (error) {
    // Replace entire catch block with new handler
    return handleApiError(error, {
      route: '/api/serp/analyze',
      context: { keyword: 'keyword' in body ? body.keyword : undefined, language: 'language' in body ? body.language : undefined },
    })
  } finally {
    logger.clearRequestId()
  }
}
```

**Step 3: Test the route manually**

Run: `cd apps/web && pnpm dev`

Test with invalid data:
```bash
curl -X POST http://localhost:3000/api/serp/analyze \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
```

Expected: 400 error with validation details, structured log in console

**Step 4: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add apps/web/src/app/api/serp/analyze/route.ts
git commit -m "feat: integrate error handler and logging into SERP analysis

- Add structured logging throughout analysis pipeline
- Track timing for performance monitoring
- Log cache hits/misses
- Log external service calls (SERP, NLP)
- Use standardized error handler
- Request ID tracking

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Integrate Error Handler into Guide Routes

**Files:**
- Modify: `apps/web/src/app/api/guides/route.ts`
- Modify: `apps/web/src/app/api/guides/[id]/route.ts`

**Step 1: Update POST /api/guides (create guide)**

In `apps/web/src/app/api/guides/route.ts`, add imports at top:

```typescript
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'
```

Wrap the POST handler:

```typescript
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('Create guide request', { requestId })

    const body = await request.json()
    const validatedData = CreateGuideSchema.parse(body)

    // ... existing guide creation logic ...

    logger.info('Guide created', {
      guideId: newGuide.id,
      keyword: validatedData.keyword,
      language: validatedData.language,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(newGuide)
  } catch (error) {
    return handleApiError(error, {
      route: '/api/guides',
      context: {},
    })
  } finally {
    logger.clearRequestId()
  }
}
```

**Step 2: Update GET /api/guides/[id] (get guide)**

In `apps/web/src/app/api/guides/[id]/route.ts`, add imports and wrap GET handler:

```typescript
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('Get guide request', { guideId: params.id, requestId })

    // ... existing get logic ...

    if (!guide) {
      throw new Error('Guide not found')
    }

    logger.info('Guide retrieved', { guideId: params.id, requestId })

    return NextResponse.json(guide)
  } catch (error) {
    return handleApiError(error, {
      route: `/api/guides/${params.id}`,
      context: { guideId: params.id },
    })
  } finally {
    logger.clearRequestId()
  }
}
```

**Step 3: Update PUT /api/guides/[id] (update guide)**

In the same file, wrap PUT handler:

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('Update guide request', { guideId: params.id, requestId })

    const body = await request.json()
    const validatedData = UpdateGuideSchema.parse(body)

    // ... existing update logic ...

    logger.info('Guide updated', {
      guideId: params.id,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(updatedGuide)
  } catch (error) {
    return handleApiError(error, {
      route: `/api/guides/${params.id}`,
      context: { guideId: params.id },
    })
  } finally {
    logger.clearRequestId()
  }
}
```

**Step 4: Update DELETE /api/guides/[id] (delete guide)**

In the same file, wrap DELETE handler:

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('Delete guide request', { guideId: params.id, requestId })

    // ... existing delete logic ...

    logger.info('Guide deleted', { guideId: params.id, requestId })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, {
      route: `/api/guides/${params.id}`,
      context: { guideId: params.id },
    })
  } finally {
    logger.clearRequestId()
  }
}
```

**Step 5: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add apps/web/src/app/api/guides/route.ts apps/web/src/app/api/guides/[id]/route.ts
git commit -m "feat: integrate error handler and logging into guide routes

- Add structured logging to all CRUD operations
- Track operation timing
- Use standardized error handler
- Request ID tracking for all routes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Error Boundary to Editor Page

**Files:**
- Modify: `apps/web/src/app/(editor)/guide/[id]/page.tsx`

**Step 1: Import and wrap with ErrorBoundary**

In `apps/web/src/app/(editor)/guide/[id]/page.tsx`:

```typescript
import { ErrorBoundary } from '@/components/error-boundary'

export default function GuidePage({ params }: { params: { id: string } }) {
  return (
    <ErrorBoundary>
      {/* Existing page content */}
      <GuideEditor guideId={params.id} />
    </ErrorBoundary>
  )
}
```

**Step 2: Test error boundary**

Temporarily add a throw in the page to test:

```typescript
export default function GuidePage({ params }: { params: { id: string } }) {
  // Test error boundary
  if (params.id === 'test-error') {
    throw new Error('Test error boundary')
  }

  return (
    <ErrorBoundary>
      <GuideEditor guideId={params.id} />
    </ErrorBoundary>
  )
}
```

Run: `cd apps/web && pnpm dev`

Visit: `http://localhost:3000/guide/test-error`

Expected: Error boundary fallback UI displayed with error card and retry button

**Step 3: Remove test code**

Remove the test throw statement

**Step 4: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add apps/web/src/app/(editor)/guide/[id]/page.tsx
git commit -m "feat: add error boundary to editor page

Wraps editor with ErrorBoundary to catch:
- TipTap initialization failures
- Content parsing errors
- Real-time update crashes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Error Boundary to Dashboard Page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Import and wrap with ErrorBoundary**

In `apps/web/src/app/(dashboard)/dashboard/page.tsx`:

```typescript
import { ErrorBoundary } from '@/components/error-boundary'

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Mes guides</h1>

      <ErrorBoundary>
        {/* Existing guide list */}
        <GuideList />
      </ErrorBoundary>
    </div>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 3: Test in browser**

Run: `cd apps/web && pnpm dev`

Visit: `http://localhost:3000/dashboard`

Expected: Dashboard loads normally, no errors

**Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: add error boundary to dashboard page

Wraps guide list with ErrorBoundary to catch:
- Data fetching failures
- Guide card rendering errors
- State management issues

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Logging to External Service Calls

**Files:**
- Modify: `apps/web/src/lib/serp.ts` (if exists)
- Modify: `apps/web/src/lib/crawler.ts` (if exists)

**Step 1: Add logging to SERP API calls**

If `apps/web/src/lib/serp.ts` exists, add logging:

```typescript
import { logger } from './logger'

export async function fetchSerpResults(keyword: string, engine: string) {
  try {
    logger.info('Fetching SERP results', { keyword, engine, provider: 'serpapi' })

    // ... existing fetch logic ...

    logger.info('SERP results received', {
      keyword,
      numResults: results.length,
      provider: 'serpapi'
    })

    return results
  } catch (error) {
    logger.error('SERP API failed', {
      keyword,
      engine,
      provider: 'serpapi',
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('Failed to fetch search results')
  }
}
```

**Step 2: Add logging to crawler**

If `apps/web/src/lib/crawler.ts` exists, add logging:

```typescript
import { logger } from './logger'

export async function crawlPage(url: string): Promise<CrawledPage> {
  try {
    logger.debug('Crawling page', { url })

    // ... existing crawl logic ...

    logger.debug('Page crawled', {
      url,
      textLength: result.text.length,
      title: result.title
    })

    return result
  } catch (error) {
    logger.warn('Page crawl failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
```

**Step 3: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add apps/web/src/lib/serp.ts apps/web/src/lib/crawler.ts
git commit -m "feat: add logging to external service calls

- Log SERP API requests and responses
- Log page crawling operations
- Track failures for debugging

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Update .env.example Documentation

**Files:**
- Modify: `.env.example`

**Step 1: Add monitoring section to .env.example**

Add at the end of `.env.example`:

```bash
# Monitoring & Logging
NODE_ENV=development  # development | production | test
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example with monitoring config

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Final Testing and Verification

**Step 1: Test all error paths**

Create a test checklist:

```bash
# API Errors
curl -X POST http://localhost:3000/api/serp/analyze -H "Content-Type: application/json" -d '{}'
# Expected: 400 validation error

curl -X GET http://localhost:3000/api/guides/invalid-uuid
# Expected: 404 not found

# Rate limit (send 6 requests rapidly)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/serp/analyze \
    -H "Content-Type: application/json" \
    -d '{"keyword":"test","language":"fr","searchEngine":"https://google.fr","guideId":"123e4567-e89b-12d3-a456-426614174000"}'
done
# Expected: 6th request returns 429 rate limit
```

**Step 2: Verify logs in console**

Run: `cd apps/web && pnpm dev`

Check console for:
- ✅ Colored logs in development
- ✅ JSON structure includes timestamp, level, message
- ✅ Request IDs present
- ✅ Sensitive data redacted

**Step 3: Test error boundaries in browser**

Visit pages and verify error boundaries work:
- `http://localhost:3000/dashboard`
- `http://localhost:3000/guide/test-id`

**Step 4: Run TypeScript check**

Run: `cd apps/web && npx tsc --noEmit`

Expected: No errors

**Step 5: Run linter**

Run: `cd apps/web && pnpm lint`

Expected: No errors (or only minor warnings)

**Step 6: Test production build**

Run: `cd apps/web && pnpm build`

Expected: Build succeeds, no errors

Check build logs for JSON format (not colorized)

**Step 7: Create final verification commit**

```bash
git add -A
git commit -m "test: verify Phase 5 monitoring implementation

All tests passing:
- API error handler working (400, 404, 429, 500, 502)
- Structured logging throughout application
- Error boundaries catching UI errors
- Request ID tracking functional
- Sensitive data redaction working
- Production build successful

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Update Documentation

**Files:**
- Create: `docs/monitoring.md`

**Step 1: Create monitoring documentation**

Create `docs/monitoring.md`:

```markdown
# Monitoring & Error Handling

This document describes the lightweight monitoring system implemented in SERPmantics.

## Overview

The application uses structured logging and error boundaries for production-ready error handling without external monitoring services.

## Components

### Structured Logger (`lib/logger.ts`)

**Usage:**
\`\`\`typescript
import { logger } from '@/lib/logger'

logger.info('Operation started', { userId, operation: 'create' })
logger.warn('Cache miss', { keyword })
logger.error('External service failed', { error: err.message })
logger.debug('Debug info', { data }) // Only in development
\`\`\`

**Features:**
- JSON logs in production
- Colorized logs in development
- Request ID tracking
- Sensitive data sanitization
- Automatic timestamp and environment

### API Error Handler (`lib/error-handler.ts`)

**Usage:**
\`\`\`typescript
import { handleApiError } from '@/lib/error-handler'

try {
  // ... API logic
} catch (error) {
  return handleApiError(error, {
    route: '/api/example',
    context: { userId, action }
  })
}
\`\`\`

**Error Types:**
- 400: Validation errors (Zod)
- 404: Resource not found
- 429: Rate limit exceeded
- 502: External service errors
- 500: Internal server errors

### React Error Boundary (`components/error-boundary.tsx`)

**Usage:**
\`\`\`typescript
import { ErrorBoundary } from '@/components/error-boundary'

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
\`\`\`

**Features:**
- Catches React rendering errors
- User-friendly fallback UI
- Retry functionality
- Dev-mode error details

## Viewing Logs

### Development
Logs are colorized and printed to console with context.

### Production
Logs are JSON-formatted and can be:
- Viewed in Vercel dashboard
- Piped to log aggregators
- Searched with `grep '"level":"error"' logs.json`

## Request Tracing

Each API request gets a unique `requestId` (format: `req_XXXXXXXXXX`).

Use request ID to trace requests across logs:
\`\`\`bash
grep "req_abc123" logs.json
\`\`\`

## Error Response Format

\`\`\`json
{
  "error": "Error type",
  "message": "User-friendly message",
  "requestId": "req_abc123",
  "timestamp": "2026-03-19T11:30:00.000Z",
  "details": {} // Only in development
}
\`\`\`

## Debugging Workflow

1. User reports error
2. Get `requestId` from error message
3. Search logs: `grep "requestId" logs.json`
4. Review full context and stack trace
5. Fix and deploy

## Future: Upgrading to Sentry

When ready to add Sentry:
1. Install `@sentry/nextjs`
2. Run Sentry wizard
3. Keep existing logger and ErrorBoundary (they complement Sentry)
4. Sentry will automatically capture errors from ErrorBoundary

See: [2026-03-19-lightweight-monitoring-design.md](plans/2026-03-19-lightweight-monitoring-design.md)
\`\`\`

**Step 2: Commit documentation**

```bash
git add docs/monitoring.md
git commit -m "docs: add monitoring and error handling guide

- Document logger usage and features
- Document error handler patterns
- Document error boundary usage
- Add debugging workflow
- Add future Sentry upgrade path

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Implementation Complete! 🎉

**Summary:**
- ✅ Structured logger with JSON formatting
- ✅ API error handler with classification
- ✅ React Error Boundaries for UI errors
- ✅ Integration in all API routes
- ✅ Integration in editor and dashboard pages
- ✅ External service logging (SERP, crawler)
- ✅ Documentation complete

**Total Time:** ~2 hours (as estimated)

**Files Created:** 4
**Files Modified:** 7
**Dependencies Added:** 1 (nanoid)

**Next Steps:**
1. Monitor logs in production
2. Adjust log levels as needed
3. Consider upgrading to Sentry when user base grows

---

## Testing Checklist

Before marking complete, verify:

- [ ] Logger outputs JSON in production
- [ ] Logger outputs colorized logs in development
- [ ] Sensitive data (password, apiKey) is redacted
- [ ] API routes return standardized error responses
- [ ] Error boundaries show fallback UI on errors
- [ ] Request IDs track requests end-to-end
- [ ] SERP analysis logs timing and cache hits
- [ ] External service failures are logged
- [ ] TypeScript compiles without errors
- [ ] Linter passes without errors
- [ ] Production build succeeds
