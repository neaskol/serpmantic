# Lightweight Monitoring Design - Phase 5 Alternative

**Date:** 2026-03-19
**Approach:** Lightweight Console Logging + Error Boundaries (No External Services)
**Status:** Design Approved

---

## 1. Overview

This design implements production-ready error handling and observability for SERPmantics without external monitoring services like Sentry. It focuses on:

- Structured console logging with JSON format
- React Error Boundaries for UI error catching
- Standardized API error handling
- Zero external dependencies

**Target Environment:** MVP/staging with budget constraints, or development environments needing observability without service setup.

---

## 2. Architecture

### 2.1 Core Components

```
apps/web/src/
├── lib/
│   ├── logger.ts              # NEW: Structured logging utility
│   └── error-handler.ts       # NEW: API error standardization
└── components/
    └── error-boundary.tsx     # NEW: React Error Boundary
```

### 2.2 Design Principles

1. **Zero External Dependencies** - No Sentry, no LogRocket, no external services
2. **Structured Logs** - JSON format with timestamps, levels, context
3. **Environment-Aware** - Verbose in dev, concise in production
4. **Type-Safe** - Full TypeScript support
5. **Performance-First** - Minimal overhead, async logging

---

## 3. Component Design

### 3.1 Structured Logger (`lib/logger.ts`)

**Purpose:** Replace scattered `console.log()` with structured, searchable logs.

**API:**

```typescript
logger.info('SERP analysis started', { keyword, language, userId })
logger.warn('Cache miss', { keyword, reason: 'expired' })
logger.error('NLP service failed', { error, keyword, duration })
logger.debug('Token count', { tokens: 1234 }) // Only in dev
```

**Output Format (Production):**

```json
{
  "timestamp": "2026-03-19T11:30:00.000Z",
  "level": "error",
  "message": "NLP service failed",
  "keyword": "test seo",
  "duration": 15230,
  "error": "ECONNREFUSED",
  "environment": "production",
  "requestId": "req_abc123"
}
```

**Output Format (Development):**

```
[11:30:00] ERROR NLP service failed
  keyword: test seo
  duration: 15230ms
  error: ECONNREFUSED
  at /api/serp/analyze:42:10
```

**Features:**

- Auto-attaches: timestamp, environment, level, hostname
- Colorized output in development (red errors, yellow warnings, green info)
- Silent debug logs in production
- Type-safe context objects with TypeScript generics
- Request ID generation and tracking
- Sensitive data sanitization (passwords, tokens)

**Implementation Details:**

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
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret']
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

---

### 3.2 React Error Boundary (`components/error-boundary.tsx`)

**Purpose:** Catch React rendering errors and show fallback UI instead of white screen.

**Usage:**

```tsx
<ErrorBoundary>
  <GuideEditor guideId={id} />
</ErrorBoundary>

// Or with custom fallback:
<ErrorBoundary fallback={<CustomErrorUI />}>
  <ComplexComponent />
</ErrorBoundary>
```

**Features:**

- Catches errors in child component tree
- Logs error with component stack trace
- Shows user-friendly fallback UI
- Retry functionality (resets error state)
- Development mode: shows error details
- Production mode: hides technical details

**Default Fallback UI:**

- Card with alert icon
- Heading: "Something went wrong"
- Message: "An unexpected error occurred. Please try again."
- Retry button (resets boundary)
- Development only: Error message + stack trace in expandable section

**Implementation:**

```tsx
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
                  <pre className="overflow-auto">
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

---

### 3.3 API Error Handler (`lib/error-handler.ts`)

**Purpose:** Standardize error responses and logging across all API routes.

**API:**

```typescript
// In any API route:
try {
  // ... business logic
} catch (error) {
  return handleApiError(error, {
    route: '/api/serp/analyze',
    context: { keyword, language }
  })
}
```

**Features:**

- Auto-classifies errors (validation, rate limit, external service, internal)
- Logs with full context and stack trace
- Returns standard JSON response
- Generates and tracks request IDs
- Sanitizes sensitive data
- Environment-aware error messages (detailed in dev, generic in prod)

**Error Classification:**

1. **Validation Error** (400) - Zod validation failures
2. **Rate Limit Error** (429) - Rate limit exceeded
3. **External Service Error** (502) - NLP/SERP service failures
4. **Not Found Error** (404) - Resource not found
5. **Internal Error** (500) - Unexpected errors

**Standard Response Format:**

```json
{
  "error": "External service error",
  "message": "NLP service is unavailable. Please try again later.",
  "requestId": "req_1234567890",
  "timestamp": "2026-03-19T11:30:00.000Z"
}
```

**Implementation:**

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
  details?: unknown // Only in development
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
    // Rate limit error (check message pattern)
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
      error.message.includes('fetch failed')
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
    if (error.message.includes('not found') || error.message.includes('Not found')) {
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

---

## 4. Integration Points

### 4.1 SERP Analysis Route

**File:** `apps/web/src/app/api/serp/analyze/route.ts`

**Changes:**
- Add structured logging for all major operations
- Track timing for performance monitoring
- Use `handleApiError` for all catch blocks
- Log cache hits/misses
- Log external service calls (NLP, SERP API)

**Example Integration:**

```typescript
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('SERP analysis started', { requestId })

    // Rate limiting (existing)
    const identifier = getUserIdentifier(request)
    const rateLimitResult = await checkRateLimit(serpRateLimit, identifier)
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded', { identifier, limit: rateLimitResult.limit })
      // ... return rate limit response
    }

    // Validation (existing)
    const body = await request.json()
    const validatedData = AnalyzeRequestSchema.parse(body)
    const { keyword, language } = validatedData

    // Check cache
    const cached = await getCachedSerpAnalysis(keyword, language)
    if (cached) {
      logger.info('Cache hit', { keyword, language, requestId })
      return NextResponse.json(cached)
    }
    logger.info('Cache miss', { keyword, language, requestId })

    // Fetch SERP results
    logger.info('Fetching SERP results', { keyword, engine: searchEngine })
    const serpResults = await fetchSerpResults(keyword, searchEngine)
    logger.info('SERP results fetched', { numResults: serpResults.length })

    // Call NLP service
    logger.info('Calling NLP service', { language, numPages: serpResults.length })
    const nlpResponse = await fetch(NLP_SERVICE_URL, { /* ... */ })

    if (!nlpResponse.ok) {
      throw new Error(`NLP service returned ${nlpResponse.status}`)
    }

    const nlpData = await nlpResponse.json()
    logger.info('NLP analysis completed', {
      termsFound: nlpData.terms.length,
      duration: Date.now() - startTime
    })

    // Save to cache
    await setCachedSerpAnalysis(keyword, language, result)
    logger.info('Results cached', { keyword, ttl: 86400 })

    logger.info('SERP analysis completed', {
      keyword,
      language,
      score: result.score,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, {
      route: '/api/serp/analyze',
      context: { keyword, language },
    })
  } finally {
    logger.clearRequestId()
  }
}
```

---

### 4.2 Editor Page

**File:** `apps/web/src/app/(editor)/guide/[id]/page.tsx`

**Changes:**
- Wrap entire page with ErrorBoundary
- Catches TipTap editor crashes, content parsing errors

**Integration:**

```tsx
import { ErrorBoundary } from '@/components/error-boundary'

export default function GuidePage({ params }: { params: { id: string } }) {
  return (
    <ErrorBoundary>
      <GuideEditor guideId={params.id} />
    </ErrorBoundary>
  )
}
```

---

### 4.3 Dashboard Page

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

**Changes:**
- Wrap guide list with ErrorBoundary
- Catches data fetching and rendering errors

**Integration:**

```tsx
import { ErrorBoundary } from '@/components/error-boundary'

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Mes guides</h1>

      <ErrorBoundary>
        <GuideList />
      </ErrorBoundary>
    </div>
  )
}
```

---

### 4.4 All API Routes

**Apply pattern to:**
- `POST /api/guides` - Create guide
- `GET /api/guides/[id]` - Get guide
- `PUT /api/guides/[id]` - Update guide
- `DELETE /api/guides/[id]` - Delete guide
- `POST /api/auth/logout` - Logout

**Standard Pattern:**

```typescript
import { logger } from '@/lib/logger'
import { handleApiError, generateRequestId } from '@/lib/error-handler'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  logger.setRequestId(requestId)

  try {
    logger.info('Create guide request', { requestId })

    // ... business logic

    logger.info('Guide created', {
      guideId: result.id,
      duration: Date.now() - startTime,
      requestId,
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, {
      route: '/api/guides',
      context: { /* relevant data */ },
    })
  } finally {
    logger.clearRequestId()
  }
}
```

---

## 5. File Structure

**New files to create:**

```
apps/web/src/
├── lib/
│   ├── logger.ts                      # ~150 lines
│   └── error-handler.ts               # ~120 lines
└── components/
    └── error-boundary.tsx             # ~100 lines
```

**Modified files:**

```
apps/web/src/app/api/
├── serp/analyze/route.ts             # Add logging + error handling
├── guides/route.ts                   # Add logging + error handling
└── guides/[id]/route.ts              # Add logging + error handling

apps/web/src/app/
├── (editor)/guide/[id]/page.tsx      # Wrap with ErrorBoundary
└── (dashboard)/dashboard/page.tsx    # Wrap with ErrorBoundary
```

---

## 6. Benefits

### 6.1 Compared to No Monitoring

✅ **Catch production errors** instead of silent failures
✅ **Structured logs** for debugging (vs scattered console.logs)
✅ **User-friendly error UI** (vs white screen of death)
✅ **Performance tracking** (request duration, slow operations)
✅ **External service monitoring** (NLP, SERP API failures)

### 6.2 Compared to Full Sentry

✅ **Zero cost** (no service subscription)
✅ **Zero setup** (no account, no DSN, no wizard)
✅ **No bundle increase** (no client-side SDK)
✅ **No privacy concerns** (logs stay on your server)
✅ **Fast implementation** (~2 hours vs 4 hours)

❌ **No centralized dashboard** (logs are in console/files)
❌ **No automatic alerting** (must monitor logs manually)
❌ **No issue aggregation** (same error appears multiple times)
❌ **No source map support** (must debug with original stack traces)

---

## 7. Production Deployment

### 7.1 Log Collection

**Options for production log management:**

1. **Vercel Logs** (if deploying to Vercel)
   - Automatically captured
   - Search via CLI: `vercel logs <deployment-url>`
   - Retention: 1 week (Hobby), 30 days (Pro)

2. **Docker Logs** (if self-hosted)
   - `docker logs <container-id> | grep "level":"error"`
   - Use log rotation to prevent disk fill

3. **File-based Logging**
   - Add file transport to logger
   - Rotate daily with `winston` or `pino`

4. **Cloud Logging** (future upgrade path)
   - CloudWatch (AWS)
   - Stackdriver (GCP)
   - Azure Monitor (Azure)

### 7.2 Log Retention

**Recommended:**
- Development: Console only, no persistence
- Staging: 7 days
- Production: 30 days minimum

### 7.3 Monitoring Workflow

**Daily:**
- Check for error logs: `grep '"level":"error"' logs.json`

**Weekly:**
- Review warning patterns
- Check performance (average request duration)

**On Error Alert:**
1. Search logs by requestId
2. Review full context + stack trace
3. Reproduce locally if needed
4. Deploy fix + monitor

---

## 8. Future Upgrade Path

**When to add Sentry:**
- User base > 100 active users
- Need automatic error alerting
- Want centralized error dashboard
- Budget allows ($26/month for Team plan)

**Migration is easy:**
1. Install `@sentry/nextjs`
2. Run Sentry wizard
3. Keep `logger` + `ErrorBoundary` (they complement Sentry)
4. Sentry will automatically capture errors from ErrorBoundary

---

## 9. Success Criteria

After implementation, we should have:

✅ All API routes use structured logging
✅ All API routes use `handleApiError`
✅ Editor page wrapped with ErrorBoundary
✅ Dashboard wrapped with ErrorBoundary
✅ No more scattered `console.log()` statements
✅ SERP analysis tracks timing + cache hits
✅ External service failures are logged with context
✅ Users see friendly error messages (not stack traces)
✅ Request IDs allow end-to-end tracing

---

## 10. Implementation Estimate

**Time:** ~2 hours

**Breakdown:**
- Create `logger.ts`: 30 mins
- Create `error-handler.ts`: 30 mins
- Create `ErrorBoundary`: 20 mins
- Integrate into SERP analysis route: 20 mins
- Integrate into other API routes: 15 mins
- Add ErrorBoundary to pages: 10 mins
- Test all error paths: 15 mins

**No external dependencies to install** - uses Node.js built-ins only.

---

## 11. Testing Checklist

After implementation, test these scenarios:

**API Errors:**
- [ ] Invalid request body (Zod validation)
- [ ] Rate limit exceeded
- [ ] NLP service down/timeout
- [ ] SERP API failure
- [ ] Supabase query error
- [ ] Guide not found

**UI Errors:**
- [ ] TipTap editor crash (invalid JSON)
- [ ] Dashboard data fetch failure
- [ ] Component render error

**Logging:**
- [ ] Logs include requestId
- [ ] Logs are JSON in production
- [ ] Logs are colorized in development
- [ ] Sensitive data is redacted
- [ ] Performance timing is tracked

**Error Boundaries:**
- [ ] Shows fallback UI on error
- [ ] Retry button works
- [ ] Error details visible in dev mode
- [ ] Error details hidden in production

---

## Conclusion

This lightweight monitoring approach provides production-ready error handling and observability without external service dependencies. It's perfect for MVP/staging environments and can easily be upgraded to Sentry when needed.

**Next Step:** Create implementation plan with detailed file-by-file changes.
