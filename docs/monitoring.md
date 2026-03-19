# Monitoring & Error Handling

This document describes the lightweight monitoring system implemented in SERPmantics.

## Overview

The application uses structured logging and error boundaries for production-ready error handling without external monitoring services.

## Components

### Structured Logger (`lib/logger.ts`)

**Usage:**
```typescript
import { logger } from '@/lib/logger'

logger.info('Operation started', { userId, operation: 'create' })
logger.warn('Cache miss', { keyword })
logger.error('External service failed', { error: err.message })
logger.debug('Debug info', { data }) // Only in development
```

**Features:**
- JSON logs in production
- Colorized logs in development
- Request ID tracking
- Sensitive data sanitization
- Automatic timestamp and environment

### API Error Handler (`lib/error-handler.ts`)

**Usage:**
```typescript
import { handleApiError } from '@/lib/error-handler'

try {
  // ... API logic
} catch (error) {
  return handleApiError(error, {
    route: '/api/example',
    context: { userId, action }
  })
}
```

**Error Types:**
- 400: Validation errors (Zod)
- 404: Resource not found
- 429: Rate limit exceeded
- 502: External service errors
- 500: Internal server errors

### React Error Boundary (`components/error-boundary.tsx`)

**Usage:**
```typescript
import { ErrorBoundary } from '@/components/error-boundary'

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

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
```bash
grep "req_abc123" logs.json
```

## Error Response Format

```json
{
  "error": "Error type",
  "message": "User-friendly message",
  "requestId": "req_abc123",
  "timestamp": "2026-03-19T11:30:00.000Z",
  "details": {} // Only in development
}
```

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


## Testing

See [Testing Guide](../apps/web/docs/testing.md) for comprehensive test coverage information.

- **Test Infrastructure**: Vitest + @vitejs/plugin-react
- **Total Tests**: 40 passing + 1 skipped
- **Coverage**: 70% (target: 80%)
- **Critical Paths**: All security features tested (CORS, CSP, rate limiting, validation)
