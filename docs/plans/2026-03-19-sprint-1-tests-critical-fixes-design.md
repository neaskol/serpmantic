# Sprint 1: Tests + Critical Fixes Design

**Date:** 2026-03-19
**Sprint Duration:** 5 working days (1 week)
**Sprint Goal:** Achieve production-ready quality with 80%+ API test coverage and critical security/performance fixes

---

## Executive Summary

This sprint implements the critical fixes and comprehensive test suite identified in the technical audit (AUDIT_COMPLET_2026-03-19.md). We follow an optimized "quick wins first" approach: deploy critical fixes on Day 1, then build comprehensive test coverage over Days 2-5.

**Success Criteria:**
- ✅ All 3 critical fixes deployed (CORS, CSP headers, N+1 queries)
- ✅ Test coverage ≥80% for API routes
- ✅ All tests passing in CI
- ✅ Zero new ESLint warnings
- ✅ Production build succeeds

---

## Timeline & Workstreams

### Day 1 (0.7d): Critical Fixes Batch
- **Fix 1:** CORS whitelist (0.2d) - Security
- **Fix 2:** CSP headers (0.5d) - Security
- **Validation:** Build + lint + manual verification

### Day 2 (1.0d): N+1 Query Fix + Test Infrastructure
- **Fix 3:** Supabase N+1 queries (0.5d) - Performance
- **Test setup:** Vitest config + mocking utilities (0.5d)

### Days 3-4 (2.0d): API Route Tests
- `/api/serp/analyze` tests (0.8d) - 12 test cases
- `/api/guides/*` tests (0.7d) - 14 test cases
- `lib/error-handler` tests (0.3d) - 7 test cases
- `lib/rate-limit` tests (0.2d) - 3 test cases

### Day 5 (1.0d): Final Polish
- Coverage validation (target: 80%+)
- Integration smoke tests
- Documentation updates
- Final commit + merge to main

---

## Critical Fixes Design

### Fix 1: CORS Whitelist (NLP Service)

**Problem:**
`services/nlp/main.py` line 26 has `allow_origins=["*"]` - accepts requests from any domain (CSRF vulnerability)

**Solution:**
```python
# services/nlp/main.py
import os

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

**Changes:**
1. Update `services/nlp/main.py` CORS config
2. Add `ALLOWED_ORIGINS` to `.env.example`
3. Update NLP Dockerfile to support env var
4. Test with both localhost:3000 and production domain

**Impact:** Prevents CSRF attacks, allows only whitelisted origins

---

### Fix 2: CSP Headers (Next.js)

**Problem:**
No Content Security Policy headers - vulnerable to XSS attacks

**Solution:**
```typescript
// apps/web/next.config.ts
const nextConfig = {
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}
```

**Design Decision:**
TipTap editor requires `unsafe-eval` and `unsafe-inline` for ProseMirror. This is acceptable for content editor applications. We document this explicitly.

**Impact:**
- Prevents XSS attacks
- Prevents clickjacking (X-Frame-Options: DENY)
- Prevents MIME sniffing attacks
- Restricts external connections to trusted domains only

---

### Fix 3: N+1 Queries (Supabase)

**Problem:**
`apps/web/src/app/api/guides/[id]/route.ts` executes 4 sequential database queries (~100ms total)

**Current Code:**
```typescript
// 4 separate queries
const { data: guide } = await supabase.from('guides').select('*').eq('id', id).single()
const { data: analysis } = await supabase.from('serp_analyses').select('*').eq('guide_id', id).single()
const { data: pages } = await supabase.from('serp_pages').select('*').eq('serp_analysis_id', analysis.id)
const { data: terms } = await supabase.from('semantic_terms').select('*').eq('serp_analysis_id', analysis.id)
```

**Solution - Single Query with Nested Joins:**
```typescript
// 1 query with nested joins
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
  .eq('id', id)
  .single()

if (error || !data) {
  throw new Error('Guide not found')
}
```

**Impact:**
- 4 queries → 1 query
- ~100ms → ~30ms (70% faster)
- Reduced database load
- Better user experience

---

## Test Infrastructure Design

### Vitest Configuration

**File:** `apps/web/vitest.config.ts`

```typescript
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

**Key decisions:**
- `environment: 'node'` - API routes are server-side
- Coverage thresholds match audit requirements (80%+)
- Path aliases match Next.js config (`@/` → `./src/`)

---

### Test Setup & Mocks

**File:** `apps/web/src/test/setup.ts`

```typescript
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
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
process.env.NLP_SERVICE_URL = 'http://localhost:8001'
process.env.SERPAPI_KEY = 'test-serp-key'
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
```

---

**File:** `apps/web/src/test/mocks.ts`

```typescript
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

**Philosophy:**
- Mock external services (Supabase, Redis, NLP, SerpAPI) - don't hit real services in tests
- Factory functions for reusable mocks
- Simple, predictable mock behavior

---

## API Route Tests Design

### Test Structure Philosophy

1. **Each API route gets its own test file** (colocated in `__tests__/` folder)
2. **Test pyramid:** Focus on request/response contracts, not implementation details
3. **Mock external services** - tests should be fast and deterministic
4. **Test error paths thoroughly** - that's where bugs hide

---

### Test File 1: `/api/serp/analyze`

**File:** `apps/web/src/app/api/serp/analyze/__tests__/route.test.ts`
**Effort:** 0.8 days
**Test cases:** 12 total

```typescript
describe('POST /api/serp/analyze', () => {
  // ✅ Happy path (1 test)
  it('should return 200 with valid analysis when all services respond')

  // ❌ Validation errors - Zod (4 tests)
  it('should return 400 when keyword is missing')
  it('should return 400 when language is invalid')
  it('should return 400 when searchEngine is not a URL')
  it('should return 400 when guideId is not a UUID')

  // ❌ Rate limiting (2 tests)
  it('should return 429 when rate limit exceeded')
  it('should return 200 when within rate limit')

  // ❌ External service failures (3 tests)
  it('should return 502 when NLP service is down')
  it('should return 502 when SerpAPI fails')
  it('should return 500 when crawling all pages fails')

  // ✅ Cache behavior (2 tests)
  it('should use cached SERP results on second request')
  it('should bypass cache when TTL expired')
})
```

**Mocking strategy:**
- Mock `@upstash/ratelimit` for rate limit tests
- Mock `global.fetch` for SerpAPI + NLP service calls
- Mock Supabase client for database inserts
- Mock Redis cache for cache hit/miss scenarios

**Coverage target:** 85% (complex business logic)

---

### Test File 2: `/api/guides` (POST & GET)

**File:** `apps/web/src/app/api/guides/__tests__/route.test.ts`
**Effort:** 0.4 days
**Test cases:** 8 total

```typescript
describe('POST /api/guides', () => {
  it('should return 201 with created guide')
  it('should return 400 when keyword is missing')
  it('should return 400 when language is invalid')
  it('should return 500 when database insert fails')
})

describe('GET /api/guides', () => {
  it('should return 200 with user guides list')
  it('should return 200 with empty array when no guides')
  it('should return 401 when user not authenticated')
  it('should filter guides by user_id only')
})
```

**Coverage target:** 90% (CRUD operations)

---

### Test File 3: `/api/guides/[id]` (GET & PUT)

**File:** `apps/web/src/app/api/guides/[id]/__tests__/route.test.ts`
**Effort:** 0.3 days
**Test cases:** 6 total

```typescript
describe('GET /api/guides/[id]', () => {
  it('should return 200 with guide + nested serp_analyses')
  it('should return 404 when guide not found')
  it('should return 400 when id is not a UUID')
})

describe('PUT /api/guides/[id]', () => {
  it('should return 200 with updated guide')
  it('should return 404 when guide not found')
  it('should return 400 when content is invalid JSON')
})
```

**Key validation:** Verify N+1 fix by asserting Supabase mock is called only once with nested select query.

**Coverage target:** 90% (CRUD operations)

---

### Test File 4: `lib/error-handler`

**File:** `apps/web/src/lib/__tests__/error-handler.test.ts`
**Effort:** 0.3 days
**Test cases:** 7 total

```typescript
describe('handleApiError', () => {
  it('should return 400 for ZodError with validation details in dev')
  it('should return 400 for ZodError without details in production')
  it('should return 429 for rate limit errors')
  it('should return 502 for NLP service errors')
  it('should return 502 for SERP service errors')
  it('should return 404 for not found errors')
  it('should return 500 for generic errors')
  it('should generate unique requestId for each error')
})

describe('generateRequestId', () => {
  it('should generate unique IDs with req_ prefix')
  it('should generate different IDs on subsequent calls')
})
```

**Coverage target:** 95% (critical error handling)

---

### Test File 5: `lib/rate-limit`

**File:** `apps/web/src/lib/__tests__/rate-limit.test.ts`
**Effort:** 0.2 days
**Test cases:** 3 total

```typescript
describe('ratelimit', () => {
  it('should allow requests within limit')
  it('should block requests exceeding limit')
  it('should use sliding window algorithm')
})
```

**Note:** This is a thin wrapper around Upstash SDK, so we mainly test configuration.

**Coverage target:** 80% (wrapper around Upstash)

---

## Day 5: Polish & Validation

### Coverage Validation Script

**Addition to `package.json`:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Validation checklist:**
```bash
# 1. Run coverage report
pnpm test:coverage

# 2. Verify thresholds met
# Expected output:
# ✓ Lines: 82.5% (threshold: 80%)
# ✓ Functions: 85.3% (threshold: 80%)
# ✓ Branches: 76.8% (threshold: 75%)
# ✓ Statements: 83.1% (threshold: 80%)

# 3. Check no test failures
# Expected: All tests passing (36+ tests)

# 4. Verify build still works
pnpm build

# 5. Lint check
pnpm lint
```

---

### Integration Smoke Tests

**File:** `apps/web/src/test/integration/smoke.test.ts`

Basic sanity checks that critical paths work end-to-end:

```typescript
describe('Integration Smoke Tests', () => {
  it('should create guide → analyze SERP → retrieve guide with data', async () => {
    // This test uses real(ish) mocked flows to verify the entire pipeline
    // POST /api/guides → POST /api/serp/analyze → GET /api/guides/[id]
  })

  it('should handle rate limiting across multiple requests', async () => {
    // Verify rate limiter actually blocks after 5 requests
  })
})
```

**Purpose:** Catch integration issues that unit tests miss (e.g., type mismatches between routes)

---

### Documentation Updates

**1. Update `docs/monitoring.md`:**
Add new section:
```markdown
## Running Tests

See [Testing Guide](./testing.md) for comprehensive testing documentation.

Quick commands:
- `pnpm test` - Run all tests
- `pnpm test:coverage` - Generate coverage report
```

**2. Update `.env.example`:**
```bash
# Add at end of file
# NLP Service Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://app.serpmantic.com
```

**3. Create `docs/testing.md`:**
```markdown
# Testing Guide

## Running Tests
- `pnpm test` - Run all tests
- `pnpm test:watch` - Watch mode for development
- `pnpm test:coverage` - Generate coverage report
- `pnpm test:ui` - Visual test UI (Vitest UI)

## Writing Tests
- Place tests in `__tests__/` folders next to source files
- Use `.test.ts` suffix for test files
- Mock external services (Supabase, Redis, NLP, SerpAPI)
- Follow existing test patterns in `src/app/api/*/route.test.ts`

## Coverage Thresholds
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

## Test Organization
- `/api/*/route.test.ts` - API route tests
- `/lib/__tests__/*.test.ts` - Utility function tests
- `/test/integration/*.test.ts` - Integration smoke tests

## Mocking Utilities
Available in `src/test/mocks.ts`:
- `createMockSupabaseClient()` - Mock Supabase client
- `createMockRateLimiter(shouldSucceed)` - Mock rate limiter
- `mockFetch(response, status)` - Mock global fetch

## Common Patterns

### Testing API Routes
```typescript
import { POST } from '../route'

describe('POST /api/example', () => {
  it('should return 200', async () => {
    const request = new Request('http://localhost/api/example', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true })
  })
})
```

### Mocking Supabase
```typescript
import { createMockSupabaseClient } from '@/test/mocks'

const mockSupabase = createMockSupabaseClient()
mockSupabase.single.mockResolvedValue({
  data: { id: '123', keyword: 'test' },
  error: null,
})
```
```

---

### Git Workflow

**Branch strategy:**
```bash
# Create feature branch from main
git checkout -b sprint-1/tests-and-critical-fixes

# Day 1 commits (critical fixes)
git commit -m "fix(nlp): restrict CORS to allowed origins only"
git commit -m "feat(security): add CSP and security headers"

# Day 2 commits
git commit -m "perf(api): fix N+1 queries in guides endpoint"
git commit -m "test: add vitest config and test utilities"

# Days 3-4 commits (grouped by test file)
git commit -m "test(api): add comprehensive tests for /api/serp/analyze"
git commit -m "test(api): add tests for /api/guides routes"
git commit -m "test(lib): add tests for error-handler"
git commit -m "test(lib): add tests for rate-limit"

# Day 5 commits (polish)
git commit -m "test(integration): add smoke tests"
git commit -m "docs: add testing guide and update monitoring docs"
git commit -m "chore: update .env.example with ALLOWED_ORIGINS"

# Final merge to main
git checkout main
git merge sprint-1/tests-and-critical-fixes
```

**Commit message convention:**
- `fix(scope):` - Bug fixes
- `feat(scope):` - New features
- `test(scope):` - Test additions
- `docs:` - Documentation
- `perf(scope):` - Performance improvements
- `chore:` - Maintenance tasks

---

## Success Criteria Checklist

Before marking sprint complete, verify:

- [ ] **Critical Fix 1:** CORS whitelist deployed
  - NLP service only accepts requests from whitelisted origins
  - `.env.example` updated with `ALLOWED_ORIGINS`
  - Tested with both localhost and production domain

- [ ] **Critical Fix 2:** CSP headers deployed
  - Security headers returned on all routes
  - `pnpm build` succeeds with headers configured
  - Manual browser verification of CSP

- [ ] **Critical Fix 3:** N+1 queries fixed
  - `/api/guides/[id]` uses single nested query
  - Response time improved (~100ms → ~30ms)
  - Tests verify single Supabase call

- [ ] **Test Coverage:** ≥80% overall
  - `pnpm test:coverage` shows passing thresholds
  - All 36+ tests passing
  - No flaky tests

- [ ] **Build & Lint:** Clean builds
  - `pnpm build` succeeds with no errors
  - `pnpm lint` shows zero warnings
  - TypeScript compilation passes

- [ ] **Documentation:** Complete
  - `docs/testing.md` created
  - `docs/monitoring.md` updated
  - `.env.example` updated

- [ ] **Git:** Clean history
  - All commits follow convention
  - Branch merged to main
  - No uncommitted changes

---

## Coverage Target Breakdown

| Component | Target | Rationale |
|-----------|--------|-----------|
| `/api/serp/analyze` | 85% | Complex business logic with multiple external services |
| `/api/guides/*` | 90% | Simple CRUD operations, should be thoroughly tested |
| `lib/error-handler` | 95% | Critical error handling, must be bulletproof |
| `lib/rate-limit` | 80% | Thin wrapper around Upstash SDK |
| **Overall** | **80%+** | Audit requirement |

---

## Risk Assessment

### Low Risk
- ✅ CORS fix - Simple config change
- ✅ N+1 query fix - Supabase supports nested selects natively
- ✅ Test setup - Vitest already in package.json

### Medium Risk
- ⚠️ CSP headers - May need adjustment if TipTap breaks
  - **Mitigation:** Test editor thoroughly after deployment
- ⚠️ Test coverage - May find unexpected edge cases
  - **Mitigation:** Budget extra time on Day 5 for coverage gaps

### High Risk
- ❌ None identified

---

## Post-Sprint Actions

After Sprint 1 completion:

1. **Deploy to staging** - Verify all fixes in staging environment
2. **Monitor logs** - Check structured logs for any new issues
3. **Performance baseline** - Measure `/api/guides/[id]` response time
4. **Schedule Sprint 2** - Component tests + E2E tests (per audit)

---

## Appendix: Test File Structure

```
apps/web/src/
├── app/
│   └── api/
│       ├── guides/
│       │   ├── __tests__/
│       │   │   └── route.test.ts (8 tests)
│       │   ├── [id]/
│       │   │   ├── __tests__/
│       │   │   │   └── route.test.ts (6 tests)
│       │   │   └── route.ts
│       │   └── route.ts
│       └── serp/
│           └── analyze/
│               ├── __tests__/
│               │   └── route.test.ts (12 tests)
│               └── route.ts
├── lib/
│   └── __tests__/
│       ├── error-handler.test.ts (8 tests)
│       └── rate-limit.test.ts (3 tests)
└── test/
    ├── setup.ts
    ├── mocks.ts
    └── integration/
        └── smoke.test.ts (2 tests)

Total: 39 tests
```

---

**End of Design Document**
