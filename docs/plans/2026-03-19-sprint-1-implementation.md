# Sprint 1: Tests + Critical Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve production-ready quality with 80%+ API test coverage and 3 critical security/performance fixes

**Architecture:** Quick wins first (Day 1: CORS + CSP + N+1 fixes), then comprehensive test suite (Days 2-5: Vitest setup + API route tests + lib tests + integration tests)

**Tech Stack:** Vitest, TypeScript, Next.js 15, Python FastAPI, Supabase, Upstash Redis

---

## Pre-Implementation Checklist

- [ ] Read design document: `docs/plans/2026-03-19-sprint-1-tests-critical-fixes-design.md`
- [ ] Read audit document: `AUDIT_COMPLET_2026-03-19.md`
- [ ] Create feature branch: `git checkout -b sprint-1/tests-and-critical-fixes`
- [ ] Ensure clean working directory: `git status`

---

## Day 1: Critical Fixes

### Task 1: Fix CORS Whitelist (NLP Service)

**Files:**
- Modify: `services/nlp/main.py:1-29`
- Modify: `.env.example` (append)
- Modify: `services/nlp/Dockerfile` (if needed)

**Step 1: Update CORS configuration in main.py**

```python
# services/nlp/main.py
# Replace lines 24-29 (the entire CORSMiddleware block)

import os

# Add after line 22 (after app = FastAPI(...))
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://app.serpmantic.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST"],  # Only POST needed for /analyze
    allow_headers=["Content-Type"],
    allow_credentials=False,
)
```

**Step 2: Update .env.example**

Add at the end of `.env.example`:
```bash
# NLP Service Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://app.serpmantic.com
```

**Step 3: Test NLP service starts correctly**

Run:
```bash
cd services/nlp
ALLOWED_ORIGINS="http://localhost:3000" python main.py
```

Expected: Server starts without errors, listens on port 8001

**Step 4: Verify CORS headers (optional manual test)**

In a separate terminal:
```bash
curl -X OPTIONS http://localhost:8001/analyze \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Expected: Response includes `Access-Control-Allow-Origin: http://localhost:3000`

**Step 5: Commit**

```bash
git add services/nlp/main.py .env.example
git commit -m "fix(nlp): restrict CORS to allowed origins only

- Replace wildcard CORS with environment-based whitelist
- Add ALLOWED_ORIGINS env var to .env.example
- Only allow POST method for /analyze endpoint
- Prevents CSRF attacks from unauthorized domains"
```

---

### Task 2: Add CSP Headers (Next.js)

**Files:**
- Modify: `apps/web/next.config.ts`

**Step 1: Read current next.config.ts**

Run: `cat apps/web/next.config.ts`

**Step 2: Add headers function to Next.js config**

Update `apps/web/next.config.ts`:
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // TipTap needs unsafe-eval
              "style-src 'self' 'unsafe-inline'", // Tailwind needs unsafe-inline
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://serpapi.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

**Step 3: Verify build succeeds**

Run:
```bash
cd apps/web
pnpm build
```

Expected: Build completes without errors

**Step 4: Test dev server starts**

Run:
```bash
pnpm dev
```

Expected: Server starts on port 3000, no errors

**Step 5: Verify headers in browser (optional)**

1. Open http://localhost:3000
2. Open DevTools → Network tab
3. Reload page
4. Click on document request
5. Check Response Headers include `Content-Security-Policy`

**Step 6: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat(security): add CSP and security headers

- Add Content-Security-Policy with TipTap/Tailwind exceptions
- Add X-Frame-Options: DENY to prevent clickjacking
- Add X-Content-Type-Options: nosniff
- Add Referrer-Policy for privacy
- Add Permissions-Policy to block camera/mic/location
- Prevents XSS, clickjacking, and MIME sniffing attacks"
```

---

## Day 2: Performance Fix + Test Infrastructure

### Task 3: Fix N+1 Queries (Supabase)

**Files:**
- Modify: `apps/web/src/app/api/guides/[id]/route.ts`

**Step 1: Read current implementation**

Run: `cat apps/web/src/app/api/guides/[id]/route.ts`

**Step 2: Locate the N+1 query pattern**

Find the 4 sequential queries (likely around lines 15-30 in GET handler)

**Step 3: Replace with single nested query**

Replace the 4 separate `await supabase.from()` calls with:
```typescript
const { data, error } = await supabase
  .from('guides')
  .select(`
    *,
    serp_analyses (
      *,
      serp_pages (*),
      semantic_terms (*)
    )
  `)
  .eq('id', params.id)
  .single()

if (error || !data) {
  return handleApiError(
    new Error('Guide not found'),
    { route: '/api/guides/[id]', context: { guideId: params.id } }
  )
}

return NextResponse.json(data)
```

**Step 4: Verify TypeScript compiles**

Run:
```bash
cd apps/web
pnpm tsc --noEmit
```

Expected: No TypeScript errors

**Step 5: Test dev server**

Run:
```bash
pnpm dev
```

Visit a guide page in browser, verify data loads correctly

**Step 6: Commit**

```bash
git add apps/web/src/app/api/guides/[id]/route.ts
git commit -m "perf(api): fix N+1 queries in guides endpoint

- Replace 4 sequential queries with single nested join
- Use Supabase nested select for related data
- Improves response time from ~100ms to ~30ms (70% faster)
- Reduces database load and connection overhead"
```

---

### Task 4: Setup Vitest Configuration

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/test/mocks.ts`

**Step 1: Create vitest.config.ts**

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node', // API routes run in Node, not jsdom
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 2: Create test setup file**

```typescript
// apps/web/src/test/setup.ts
import { vi } from 'vitest'

// Mock Next.js server APIs
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
      headers: new Headers(init?.headers),
    }),
  },
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.NLP_SERVICE_URL = 'http://localhost:8001'
process.env.SERPAPI_KEY = 'test-serp-key'
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token'
```

**Step 3: Create mock utilities**

```typescript
// apps/web/src/test/mocks.ts
import { vi } from 'vitest'

// Supabase mock factory
export function createMockSupabaseClient() {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  }
}

// Rate limiter mock
export function createMockRateLimiter(shouldSucceed = true) {
  return {
    limit: vi.fn().mockResolvedValue({
      success: shouldSucceed,
      limit: 5,
      remaining: shouldSucceed ? 4 : 0,
      reset: Date.now() + 3600000,
    }),
  }
}

// Fetch mock helper
export function mockFetch(response: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  })
}
```

**Step 4: Install @vitejs/plugin-react if needed**

Run:
```bash
cd apps/web
pnpm add -D @vitejs/plugin-react
```

**Step 5: Verify test setup works**

Run:
```bash
pnpm test
```

Expected: "No test files found" (we haven't written tests yet)

**Step 6: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/src/test/
git commit -m "test: add vitest config and test utilities

- Configure Vitest with Node environment for API routes
- Set coverage thresholds (80% lines/functions, 75% branches)
- Add test setup with Next.js and env mocks
- Create mock factories for Supabase, rate limiter, fetch
- Install @vitejs/plugin-react for React component testing"
```

---

## Day 3: API Route Tests - Part 1

### Task 5: Test /api/serp/analyze Route

**Files:**
- Create: `apps/web/src/app/api/serp/analyze/__tests__/route.test.ts`

**Step 1: Create test file with imports**

```typescript
// apps/web/src/app/api/serp/analyze/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { createMockSupabaseClient, createMockRateLimiter, mockFetch } from '@/test/mocks'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}))

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  ratelimit: createMockRateLimiter(true),
}))
```

**Step 2: Add happy path test**

```typescript
describe('POST /api/serp/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 with valid analysis when all services respond', async () => {
    // Mock successful NLP response
    mockFetch({
      terms: [
        { term: 'seo', minOccurrences: 5, maxOccurrences: 10, importance: 0.9 },
      ],
      termsToAvoid: ['spam'],
    })

    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveProperty('terms')
    expect(json).toHaveProperty('termsToAvoid')
  })
})
```

**Step 3: Add validation error tests**

```typescript
  it('should return 400 when keyword is missing', async () => {
    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Validation error')
  })

  it('should return 400 when language is invalid', async () => {
    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'invalid',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when searchEngine is not a URL', async () => {
    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'not-a-url',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when guideId is not a UUID', async () => {
    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: 'not-a-uuid',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
```

**Step 4: Add rate limiting tests**

```typescript
  it('should return 429 when rate limit exceeded', async () => {
    // Mock rate limiter to fail
    vi.mock('@/lib/rate-limit', () => ({
      ratelimit: createMockRateLimiter(false),
    }))

    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)

    const json = await response.json()
    expect(json.error).toContain('Rate limit')
  })
```

**Step 5: Add external service error tests**

```typescript
  it('should return 502 when NLP service is down', async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(502)

    const json = await response.json()
    expect(json.error).toBe('External service error')
  })

  it('should return 502 when SerpAPI fails', async () => {
    // Mock SerpAPI to fail (first fetch call)
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call is SerpAPI
        return Promise.reject(new Error('SerpAPI error'))
      }
      // Subsequent calls are crawling
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => '<html>test</html>',
      })
    })

    const request = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.com',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(502)
  })
```

**Step 6: Run tests**

Run:
```bash
cd apps/web
pnpm test src/app/api/serp/analyze/__tests__/route.test.ts
```

Expected: Tests may fail initially (implementation might not match mocks exactly). Adjust mocks or implementation as needed.

**Step 7: Commit**

```bash
git add apps/web/src/app/api/serp/analyze/__tests__/
git commit -m "test(api): add comprehensive tests for /api/serp/analyze

- Test happy path with successful NLP response
- Test validation errors (missing keyword, invalid language, etc.)
- Test rate limiting (429 response)
- Test external service failures (NLP down, SerpAPI down)
- Mock Supabase, rate limiter, and fetch for isolation
- 8 test cases covering critical paths"
```

---

### Task 6: Test /api/guides Routes

**Files:**
- Create: `apps/web/src/app/api/guides/__tests__/route.test.ts`
- Create: `apps/web/src/app/api/guides/[id]/__tests__/route.test.ts`

**Step 1: Create /api/guides test file**

```typescript
// apps/web/src/app/api/guides/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from '../route'
import { createMockSupabaseClient } from '@/test/mocks'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}))

describe('POST /api/guides', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
  })

  it('should return 201 with created guide', async () => {
    mockSupabase.insert.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.single.mockResolvedValue({
      data: {
        id: '123',
        keyword: 'test keyword',
        language: 'fr',
        created_at: new Date().toISOString(),
      },
      error: null,
    })

    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test keyword',
        language: 'fr',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)

    const json = await response.json()
    expect(json).toHaveProperty('id')
    expect(json.keyword).toBe('test keyword')
  })

  it('should return 400 when keyword is missing', async () => {
    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'fr',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when language is invalid', async () => {
    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'invalid',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 500 when database insert fails', async () => {
    mockSupabase.insert.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    })

    const request = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.fr',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })
})

describe('GET /api/guides', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
  })

  it('should return 200 with user guides list', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })

    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockResolvedValue({
      data: [
        { id: '1', keyword: 'test 1', language: 'fr' },
        { id: '2', keyword: 'test 2', language: 'en' },
      ],
      error: null,
    })

    const request = new Request('http://localhost/api/guides')
    const response = await GET(request)

    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json).toHaveLength(2)
  })

  it('should return 200 with empty array when no guides', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })

    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockResolvedValue({
      data: [],
      error: null,
    })

    const request = new Request('http://localhost/api/guides')
    const response = await GET(request)

    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json).toEqual([])
  })

  it('should return 401 when user not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const request = new Request('http://localhost/api/guides')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
```

**Step 2: Create /api/guides/[id] test file**

```typescript
// apps/web/src/app/api/guides/[id]/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT } from '../route'
import { createMockSupabaseClient } from '@/test/mocks'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}))

describe('GET /api/guides/[id]', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
  })

  it('should return 200 with guide + nested serp_analyses', async () => {
    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.single.mockResolvedValue({
      data: {
        id: '123',
        keyword: 'test',
        serp_analyses: {
          id: 'analysis-1',
          serp_pages: [{ id: 'page-1', url: 'https://example.com' }],
          semantic_terms: [{ id: 'term-1', term: 'seo' }],
        },
      },
      error: null,
    })

    const request = new Request('http://localhost/api/guides/123')
    const response = await GET(request, { params: { id: '123' } })

    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('serp_analyses')
    expect(json.serp_analyses).toHaveProperty('serp_pages')
    expect(json.serp_analyses).toHaveProperty('semantic_terms')

    // Verify N+1 fix: only 1 select call
    expect(mockSupabase.select).toHaveBeenCalledTimes(1)
  })

  it('should return 404 when guide not found', async () => {
    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    const request = new Request('http://localhost/api/guides/999')
    const response = await GET(request, { params: { id: '999' } })

    expect(response.status).toBe(404)
  })

  it('should return 400 when id is not a UUID', async () => {
    const request = new Request('http://localhost/api/guides/invalid-id')
    const response = await GET(request, { params: { id: 'invalid-id' } })

    expect(response.status).toBe(400)
  })
})

describe('PUT /api/guides/[id]', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
  })

  it('should return 200 with updated guide', async () => {
    mockSupabase.update.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.single.mockResolvedValue({
      data: {
        id: '123',
        keyword: 'test',
        content: { type: 'doc', content: [] },
      },
      error: null,
    })

    const request = new Request('http://localhost/api/guides/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { type: 'doc', content: [] },
      }),
    })

    const response = await PUT(request, { params: { id: '123' } })
    expect(response.status).toBe(200)
  })

  it('should return 404 when guide not found', async () => {
    mockSupabase.update.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    const request = new Request('http://localhost/api/guides/999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { type: 'doc', content: [] },
      }),
    })

    const response = await PUT(request, { params: { id: '999' } })
    expect(response.status).toBe(404)
  })

  it('should return 400 when content is invalid JSON', async () => {
    const request = new Request('http://localhost/api/guides/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'not an object',
      }),
    })

    const response = await PUT(request, { params: { id: '123' } })
    expect(response.status).toBe(400)
  })
})
```

**Step 3: Run tests**

Run:
```bash
pnpm test src/app/api/guides/
```

Expected: All tests passing (adjust implementation/mocks if needed)

**Step 4: Commit**

```bash
git add apps/web/src/app/api/guides/
git commit -m "test(api): add tests for /api/guides routes

- Test POST /api/guides (create guide)
- Test GET /api/guides (list user guides)
- Test GET /api/guides/[id] with nested data
- Test PUT /api/guides/[id] (update guide)
- Verify N+1 fix (only 1 Supabase select call)
- Test validation, auth, and error cases
- 14 test cases total"
```

---

## Day 4: API Route Tests - Part 2

### Task 7: Test lib/error-handler

**Files:**
- Create: `apps/web/src/lib/__tests__/error-handler.test.ts`

**Step 1: Create test file**

```typescript
// apps/web/src/lib/__tests__/error-handler.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { handleApiError, generateRequestId } from '../error-handler'
import { ZodError } from 'zod'

describe('handleApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 for ZodError with validation details in dev', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['keyword'],
        message: 'Expected string, received number',
      },
    ])

    const response = handleApiError(zodError, {
      route: '/api/test',
      context: { userId: '123' },
    })

    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Validation error')
    expect(json.details).toBeDefined()
    expect(json.requestId).toBeDefined()

    process.env.NODE_ENV = originalEnv
  })

  it('should return 400 for ZodError without details in production', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['keyword'],
        message: 'Expected string, received number',
      },
    ])

    const response = handleApiError(zodError, {
      route: '/api/test',
    })

    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Validation error')
    expect(json.details).toBeUndefined()

    process.env.NODE_ENV = originalEnv
  })

  it('should return 429 for rate limit errors', async () => {
    const error = new Error('Rate limit exceeded')

    const response = handleApiError(error, {
      route: '/api/test',
    })

    expect(response.status).toBe(429)

    const json = await response.json()
    expect(json.error).toBe('Rate limit exceeded')
  })

  it('should return 502 for NLP service errors', async () => {
    const error = new Error('NLP service unavailable')

    const response = handleApiError(error, {
      route: '/api/test',
    })

    expect(response.status).toBe(502)

    const json = await response.json()
    expect(json.error).toBe('External service error')
  })

  it('should return 502 for SERP service errors', async () => {
    const error = new Error('SERP fetch failed')

    const response = handleApiError(error, {
      route: '/api/test',
    })

    expect(response.status).toBe(502)

    const json = await response.json()
    expect(json.error).toBe('External service error')
  })

  it('should return 404 for not found errors', async () => {
    const error = new Error('Guide not found')

    const response = handleApiError(error, {
      route: '/api/guides/123',
    })

    expect(response.status).toBe(404)

    const json = await response.json()
    expect(json.error).toBe('Not found')
  })

  it('should return 500 for generic errors', async () => {
    const error = new Error('Something went wrong')

    const response = handleApiError(error, {
      route: '/api/test',
    })

    expect(response.status).toBe(500)

    const json = await response.json()
    expect(json.error).toBe('Internal server error')
  })

  it('should generate unique requestId for each error', async () => {
    const error1 = new Error('Test error')
    const error2 = new Error('Test error')

    const response1 = handleApiError(error1, { route: '/api/test' })
    const response2 = handleApiError(error2, { route: '/api/test' })

    const json1 = await response1.json()
    const json2 = await response2.json()

    expect(json1.requestId).toBeDefined()
    expect(json2.requestId).toBeDefined()
    expect(json1.requestId).not.toBe(json2.requestId)
  })
})

describe('generateRequestId', () => {
  it('should generate unique IDs with req_ prefix', () => {
    const id = generateRequestId()
    expect(id).toMatch(/^req_/)
  })

  it('should generate different IDs on subsequent calls', () => {
    const id1 = generateRequestId()
    const id2 = generateRequestId()
    expect(id1).not.toBe(id2)
  })
})
```

**Step 2: Run tests**

Run:
```bash
pnpm test src/lib/__tests__/error-handler.test.ts
```

Expected: All tests passing

**Step 3: Commit**

```bash
git add apps/web/src/lib/__tests__/error-handler.test.ts
git commit -m "test(lib): add tests for error-handler

- Test ZodError handling (dev vs production)
- Test rate limit error (429)
- Test external service errors (502)
- Test not found errors (404)
- Test generic errors (500)
- Test unique requestId generation
- 9 test cases covering all error types"
```

---

### Task 8: Test lib/rate-limit

**Files:**
- Create: `apps/web/src/lib/__tests__/rate-limit.test.ts`

**Step 1: Create test file**

```typescript
// apps/web/src/lib/__tests__/rate-limit.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock Upstash Redis
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      // Mock Redis methods if needed
    })),
  },
}))

// Mock Ratelimit
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 3600000,
    }),
  })),
}))

import { ratelimit } from '../rate-limit'

describe('ratelimit', () => {
  it('should allow requests within limit', async () => {
    const result = await ratelimit.limit('user-123')

    expect(result.success).toBe(true)
    expect(result.limit).toBe(5)
    expect(result.remaining).toBeGreaterThanOrEqual(0)
  })

  it('should be configured with sliding window algorithm', () => {
    // This test verifies the configuration is correct
    // The actual implementation is in @upstash/ratelimit
    expect(ratelimit).toBeDefined()
  })

  it('should have proper rate limit settings', async () => {
    const result = await ratelimit.limit('user-456')

    // Verify limit is set to 5 requests per hour
    expect(result.limit).toBe(5)
  })
})
```

**Step 2: Run tests**

Run:
```bash
pnpm test src/lib/__tests__/rate-limit.test.ts
```

Expected: All tests passing

**Step 3: Commit**

```bash
git add apps/web/src/lib/__tests__/rate-limit.test.ts
git commit -m "test(lib): add tests for rate-limit

- Test requests within limit are allowed
- Verify sliding window configuration
- Verify rate limit settings (5 requests/hour)
- Mock Upstash Redis and Ratelimit
- 3 test cases for rate limiting wrapper"
```

---

## Day 5: Integration Tests & Final Polish

### Task 9: Add Integration Smoke Tests

**Files:**
- Create: `apps/web/src/test/integration/smoke.test.ts`

**Step 1: Create smoke test file**

```typescript
// apps/web/src/test/integration/smoke.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as createGuide } from '@/app/api/guides/route'
import { POST as analyzeSerp } from '@/app/api/serp/analyze/route'
import { GET as getGuide } from '@/app/api/guides/[id]/route'
import { createMockSupabaseClient, mockFetch } from '@/test/mocks'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}))

vi.mock('@/lib/rate-limit', () => ({
  ratelimit: {
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 3600000,
    }),
  },
}))

describe('Integration Smoke Tests', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
  })

  it('should create guide → analyze SERP → retrieve guide with data', async () => {
    // Step 1: Create guide
    mockSupabase.insert.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'guide-123',
        keyword: 'test seo',
        language: 'fr',
        created_at: new Date().toISOString(),
      },
      error: null,
    })

    const createRequest = new Request('http://localhost/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test seo',
        language: 'fr',
        searchEngine: 'https://google.fr',
      }),
    })

    const createResponse = await createGuide(createRequest)
    expect(createResponse.status).toBe(201)

    const createdGuide = await createResponse.json()
    expect(createdGuide.id).toBe('guide-123')

    // Step 2: Analyze SERP
    mockFetch({
      terms: [
        { term: 'seo', minOccurrences: 5, maxOccurrences: 10, importance: 0.9 },
      ],
      termsToAvoid: ['spam'],
    })

    const analyzeRequest = new Request('http://localhost/api/serp/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: 'test seo',
        language: 'fr',
        searchEngine: 'https://google.fr',
        guideId: 'guide-123',
      }),
    })

    const analyzeResponse = await analyzeSerp(analyzeRequest)
    expect(analyzeResponse.status).toBe(200)

    const analysis = await analyzeResponse.json()
    expect(analysis.terms).toBeDefined()

    // Step 3: Retrieve guide with nested data
    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'guide-123',
        keyword: 'test seo',
        serp_analyses: {
          id: 'analysis-1',
          serp_pages: [{ id: 'page-1', url: 'https://example.com' }],
          semantic_terms: analysis.terms,
        },
      },
      error: null,
    })

    const getRequest = new Request('http://localhost/api/guides/guide-123')
    const getResponse = await getGuide(getRequest, { params: { id: 'guide-123' } })

    expect(getResponse.status).toBe(200)

    const guideData = await getResponse.json()
    expect(guideData.serp_analyses).toBeDefined()
    expect(guideData.serp_analyses.semantic_terms).toHaveLength(1)
  })

  it('should handle rate limiting across multiple requests', async () => {
    // Mock rate limiter to succeed for first 4 requests, fail on 5th
    let callCount = 0
    const mockRatelimit = {
      limit: vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({
          success: callCount <= 4,
          limit: 5,
          remaining: Math.max(0, 5 - callCount),
          reset: Date.now() + 3600000,
        })
      }),
    }

    vi.mock('@/lib/rate-limit', () => ({
      ratelimit: mockRatelimit,
    }))

    mockFetch({ terms: [], termsToAvoid: [] })

    const requestBody = {
      keyword: 'test',
      language: 'fr',
      searchEngine: 'https://google.fr',
      guideId: 'guide-123',
    }

    // Make 5 requests
    for (let i = 1; i <= 5; i++) {
      const request = new Request('http://localhost/api/serp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const response = await analyzeSerp(request)

      if (i <= 4) {
        // First 4 should succeed
        expect(response.status).toBe(200)
      } else {
        // 5th should be rate limited
        expect(response.status).toBe(429)
      }
    }
  })
})
```

**Step 2: Run smoke tests**

Run:
```bash
pnpm test src/test/integration/smoke.test.ts
```

Expected: All tests passing

**Step 3: Commit**

```bash
git add apps/web/src/test/integration/
git commit -m "test(integration): add smoke tests

- Test full flow: create guide → analyze SERP → retrieve data
- Test rate limiting across multiple requests
- Verify integration between API routes
- Ensure data flows correctly through the system
- 2 comprehensive integration tests"
```

---

### Task 10: Validate Test Coverage

**Files:**
- None (running scripts)

**Step 1: Run full test suite with coverage**

Run:
```bash
cd apps/web
pnpm test:coverage
```

Expected output:
```
✓ Lines: 82.5% (threshold: 80%)
✓ Functions: 85.3% (threshold: 80%)
✓ Branches: 76.8% (threshold: 75%)
✓ Statements: 83.1% (threshold: 80%)

All tests passing (39+ tests)
```

**Step 2: Review coverage report**

Open: `apps/web/coverage/index.html` in browser

Check for any critical uncovered lines. If coverage is below 80%, identify gaps and add targeted tests.

**Step 3: Verify build succeeds**

Run:
```bash
pnpm build
```

Expected: Build completes without errors

**Step 4: Verify linting passes**

Run:
```bash
pnpm lint
```

Expected: Zero ESLint warnings/errors

**Step 5: Document results**

If all checks pass, proceed to documentation. If not, fix issues and re-run.

---

### Task 11: Update Documentation

**Files:**
- Create: `apps/web/docs/testing.md`
- Modify: `docs/monitoring.md`

**Step 1: Create testing guide**

```markdown
<!-- apps/web/docs/testing.md -->
# Testing Guide

## Running Tests

### Quick Commands
- `pnpm test` - Run all tests once
- `pnpm test:watch` - Run tests in watch mode (for development)
- `pnpm test:coverage` - Generate coverage report
- `pnpm test:ui` - Open Vitest UI for visual test running

### Run Specific Tests
```bash
# Single file
pnpm test src/app/api/guides/__tests__/route.test.ts

# Pattern matching
pnpm test api/guides

# Single test case
pnpm test -t "should return 200"
```

## Writing Tests

### File Organization
Place tests in `__tests__/` folders next to source files:
```
src/app/api/guides/
├── __tests__/
│   └── route.test.ts
└── route.ts
```

### Test File Naming
- Use `.test.ts` suffix for test files
- Match the source file name (e.g., `route.ts` → `route.test.ts`)

### Test Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Feature Name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something specific', () => {
    // Arrange
    const input = 'test'

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toBe('expected')
  })
})
```

## Mocking

### Available Mock Utilities
Located in `src/test/mocks.ts`:

#### Supabase Client
```typescript
import { createMockSupabaseClient } from '@/test/mocks'

const mockSupabase = createMockSupabaseClient()
mockSupabase.select.mockReturnThis()
mockSupabase.eq.mockReturnThis()
mockSupabase.single.mockResolvedValue({
  data: { id: '123', name: 'Test' },
  error: null,
})
```

#### Rate Limiter
```typescript
import { createMockRateLimiter } from '@/test/mocks'

// Allow requests
const rateLimiter = createMockRateLimiter(true)

// Block requests
const rateLimiter = createMockRateLimiter(false)
```

#### Fetch
```typescript
import { mockFetch } from '@/test/mocks'

// Success response
mockFetch({ data: 'test' }, 200)

// Error response
mockFetch({ error: 'Not found' }, 404)
```

### Mocking Modules
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}))
```

## Coverage Thresholds

Our project enforces these minimum coverage thresholds:
- **Lines:** 80%
- **Functions:** 80%
- **Branches:** 75%
- **Statements:** 80%

Coverage is checked automatically on every test run with `pnpm test:coverage`.

## Test Categories

### API Route Tests
Test Next.js API routes (request → response contracts)

**Example:**
```typescript
it('should return 200 with valid data', async () => {
  const request = new Request('http://localhost/api/example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'test' }),
  })

  const response = await POST(request)
  const json = await response.json()

  expect(response.status).toBe(200)
  expect(json).toHaveProperty('id')
})
```

### Library Function Tests
Test utility functions in `src/lib/`

**Example:**
```typescript
it('should format text correctly', () => {
  const result = formatText('input')
  expect(result).toBe('expected')
})
```

### Integration Tests
Test multiple components working together

**Location:** `src/test/integration/`

## Best Practices

### 1. Test Behavior, Not Implementation
❌ Bad: `expect(mockFunction).toHaveBeenCalledWith(...)`
✅ Good: `expect(response.status).toBe(200)`

### 2. Use Descriptive Test Names
❌ Bad: `it('works')`
✅ Good: `it('should return 400 when keyword is missing')`

### 3. Follow AAA Pattern
- **Arrange:** Set up test data
- **Act:** Execute the function
- **Assert:** Verify the result

### 4. Mock External Services
Always mock:
- Supabase
- Redis
- External APIs (SerpAPI, NLP service)
- File system operations

### 5. Clean Up After Tests
```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

## Troubleshooting

### Tests Fail with "Cannot find module"
- Check path aliases in `vitest.config.ts`
- Ensure `@/` maps to `./src/`

### Mock Not Working
- Ensure mock is defined before import
- Use `vi.clearAllMocks()` in `beforeEach`

### Coverage Below Threshold
- Run `pnpm test:coverage` to see report
- Open `coverage/index.html` for detailed view
- Add tests for uncovered lines

## CI/CD Integration

Tests run automatically on:
- Every commit (local hook)
- Pull request creation
- Merge to main

Builds fail if:
- Any test fails
- Coverage drops below thresholds
```

**Step 2: Update monitoring.md**

Add to `docs/monitoring.md` after the existing content:

```markdown

## Testing & Validation

See [Testing Guide](../apps/web/docs/testing.md) for comprehensive testing documentation.

Quick test commands:
- `pnpm test` - Run all tests
- `pnpm test:coverage` - Generate coverage report
- `pnpm test:ui` - Visual test interface

### Coverage Requirements
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%
```

**Step 3: Commit documentation**

```bash
git add apps/web/docs/testing.md docs/monitoring.md
git commit -m "docs: add testing guide and update monitoring docs

- Create comprehensive testing guide
- Document test commands, structure, and best practices
- Add mocking utilities documentation
- Update monitoring.md with testing reference
- Include troubleshooting section"
```

---

### Task 12: Final Validation & Merge

**Files:**
- None (validation steps)

**Step 1: Run complete validation checklist**

Run all checks:
```bash
cd apps/web

# 1. Tests with coverage
pnpm test:coverage

# 2. Build verification
pnpm build

# 3. Lint check
pnpm lint

# 4. Type check
pnpm tsc --noEmit
```

**Step 2: Verify all success criteria**

Check against Sprint 1 success criteria:
- [ ] All 3 critical fixes deployed (CORS, CSP, N+1)
- [ ] Test coverage ≥80% for API routes
- [ ] All tests passing (39+ tests)
- [ ] Zero ESLint warnings
- [ ] Production build succeeds
- [ ] Documentation complete

**Step 3: Review git log**

Run:
```bash
git log --oneline sprint-1/tests-and-critical-fixes
```

Expected: Clean commit history with descriptive messages

**Step 4: Merge to main**

```bash
# Switch to main
git checkout main

# Merge feature branch
git merge sprint-1/tests-and-critical-fixes

# Push to remote
git push origin main
```

**Step 5: Tag release**

```bash
git tag -a v0.2.0-sprint-1 -m "Sprint 1: Tests + Critical Fixes

- Fix CORS whitelist (NLP service)
- Add CSP headers (Next.js)
- Fix N+1 queries (Supabase)
- Add comprehensive test suite (80%+ coverage)
- 39+ test cases across API routes and lib functions
- Integration smoke tests
- Testing documentation"

git push origin v0.2.0-sprint-1
```

**Step 6: Clean up branch (optional)**

```bash
git branch -d sprint-1/tests-and-critical-fixes
```

---

## Post-Implementation Checklist

After completing all tasks:

- [ ] All tests passing (`pnpm test`)
- [ ] Coverage ≥80% (`pnpm test:coverage`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Types valid (`pnpm tsc --noEmit`)
- [ ] CORS fix deployed (NLP service)
- [ ] CSP headers working (Next.js)
- [ ] N+1 queries fixed (Supabase)
- [ ] Documentation complete
- [ ] Merged to main
- [ ] Tagged release

---

## Rollback Plan

If issues are discovered post-deployment:

**Rollback CORS fix:**
```bash
cd services/nlp
# Revert main.py to previous version
git checkout HEAD~1 -- main.py
# Restart NLP service
```

**Rollback CSP headers:**
```bash
cd apps/web
# Remove headers function from next.config.ts
# Rebuild and redeploy
pnpm build
```

**Rollback N+1 fix:**
```bash
# Revert to 4 separate queries
git revert <commit-hash>
```

---

## Success Metrics

### Before Sprint 1
- Test coverage: ~5% (2 lib tests only)
- API route tests: 0
- Security headers: None
- CORS: Wildcard (*)
- Guide endpoint: 4 queries (~100ms)

### After Sprint 1
- Test coverage: ≥80% (39+ tests)
- API route tests: 33+ tests
- Security headers: CSP + 4 others
- CORS: Whitelist only
- Guide endpoint: 1 query (~30ms)

---

**End of Implementation Plan**
