# Full Sprint Implementation Plan - SERPmantics Production Ready

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SERPmantics from MVP (6.5/10) to production-ready (8.5/10) with NLP service completion, security hardening, performance optimization, monitoring, comprehensive tests, and CI/CD automation.

**Architecture:** Three-layer defense (validation → rate limiting → error handling), Redis caching for SERP results, Sentry monitoring with error boundaries, comprehensive test coverage (>80%), and automated CI/CD pipeline.

**Tech Stack:** Next.js 15, React 19, Python FastAPI, spaCy, Upstash Redis, Sentry, Vitest, Playwright, pytest, Docker, GitHub Actions

**Duration:** 2 weeks (10 working days)

**Reference Design:** [`docs/plans/2026-03-19-full-sprint-implementation.md`](./2026-03-19-full-sprint-implementation.md)

---

## Week 1: Critical Foundations

### Phase 1: NLP Service Production-Ready (Days 1-2)

#### Task 1.1: Create NLP Service Dockerfile

**Files:**
- Create: `services/nlp/Dockerfile`
- Create: `services/nlp/.dockerignore`

**Step 1: Create .dockerignore**

```bash
# services/nlp/.dockerignore
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
.pytest_cache/
.coverage
htmlcov/
.venv/
*.egg-info/
```

**Step 2: Create multi-stage Dockerfile**

```dockerfile
# services/nlp/Dockerfile
FROM python:3.11-slim as base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy models (cached layer)
RUN python -m spacy download fr_core_news_sm && \
    python -m spacy download en_core_web_sm && \
    python -m spacy download it_core_news_sm && \
    python -m spacy download de_core_news_sm && \
    python -m spacy download es_core_news_sm

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Non-root user for security
RUN useradd -m -u 1000 nlp && chown -R nlp:nlp /app
USER nlp

# Expose port
EXPOSE 8001

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
```

**Step 3: Test Docker build locally**

```bash
cd services/nlp
docker build -t serpmantic-nlp:test .
```

Expected: Build succeeds, all spaCy models downloaded

**Step 4: Test Docker run**

```bash
docker run -p 8001:8001 serpmantic-nlp:test
```

Expected: Service starts, health check passes at http://localhost:8001/health

**Step 5: Commit**

```bash
git add services/nlp/Dockerfile services/nlp/.dockerignore
git commit -m "feat(nlp): add production Dockerfile with multi-stage build

- Install system deps (gcc, curl)
- Cache spaCy models in Docker layer
- Health check with 30s interval
- Run as non-root user for security
- 2 workers for better concurrency

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 1.2: Enhance NLP Service Health Checks

**Files:**
- Modify: `services/nlp/main.py`

**Step 1: Add structured logging helper**

```python
# services/nlp/main.py (add after imports)
import json
from datetime import datetime

def log_structured(level: str, message: str, **kwargs):
    """Structured JSON logging"""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "level": level,
        "message": message,
        **kwargs
    }
    logger.info(json.dumps(log_entry))
```

**Step 2: Update /health/ready endpoint**

```python
# services/nlp/main.py (add after /health endpoint)
@app.get("/health/ready")
def health_ready():
    """Readiness check - verify models are loaded"""
    from pipeline import _models
    return {
        "status": "ready",
        "models_loaded": list(_models.keys()),
        "timestamp": datetime.utcnow().isoformat()
    }
```

**Step 3: Update /analyze endpoint with logging**

```python
# services/nlp/main.py (replace existing /analyze)
@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    try:
        log_structured("info", "Analysis started",
                      language=req.language,
                      num_texts=len(req.texts))

        result = analyze_corpus(req.texts, req.language)

        log_structured("info", "Analysis completed",
                      language=req.language,
                      num_terms=len(result["terms"]))

        return result
    except Exception as e:
        log_structured("error", "Analysis failed",
                      language=req.language,
                      error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 4: Test health endpoints**

```bash
# Start service
uvicorn main:app --reload

# Test basic health
curl http://localhost:8001/health

# Test readiness
curl http://localhost:8001/health/ready
```

Expected: Both return 200, `/health/ready` shows loaded models

**Step 5: Commit**

```bash
git add services/nlp/main.py
git commit -m "feat(nlp): add structured logging and /health/ready endpoint

- Structured JSON logging for better observability
- /health/ready checks if spaCy models loaded
- Enhanced error handling in /analyze
- Log analysis start/complete/failure events

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 1.3: Improve NLP Pipeline Error Handling

**Files:**
- Modify: `services/nlp/pipeline.py`

**Step 1: Add input validation**

```python
# services/nlp/pipeline.py (update analyze_corpus function start)
def analyze_corpus(texts: list[str], language: str) -> dict:
    """
    Analyze a corpus of SERP page texts.
    Returns semantic terms with occurrence ranges and terms to avoid.
    """
    # Validate inputs
    if not texts:
        logger.warning("Empty corpus provided")
        return {"terms": [], "terms_to_avoid": []}

    if language not in ["fr", "en", "it", "de", "es"]:
        raise ValueError(f"Unsupported language: {language}")

    try:
        nlp = get_nlp(language)
    except Exception as e:
        logger.error(f"Failed to load spaCy model for {language}: {e}")
        raise ValueError(f"Language model not available: {language}")
```

**Step 2: Add per-document error handling**

```python
# services/nlp/pipeline.py (update lemmatization loop)
    # Lemmatize all texts
    lemmatized_texts = []
    all_tokens_per_doc = []

    for i, text in enumerate(texts):
        try:
            tokens = lemmatize_text(text, language)
            if not tokens:
                logger.warning(f"Document {i} produced no tokens")
                continue
            lemmatized_texts.append(" ".join(tokens))
            all_tokens_per_doc.append(tokens)
        except Exception as e:
            logger.error(f"Failed to lemmatize document {i}: {e}")
            continue

    if len(lemmatized_texts) < 2:
        logger.warning("Not enough valid documents for TF-IDF analysis")
        return {"terms": [], "terms_to_avoid": []}
```

**Step 3: Test error handling**

```bash
pytest services/nlp/tests/ -v -k "test_analyze"
```

Expected: Tests pass, error cases handled gracefully

**Step 4: Commit**

```bash
git add services/nlp/pipeline.py
git commit -m "feat(nlp): improve error handling in pipeline

- Validate language input (only fr/en/it/de/es)
- Gracefully handle failed document lemmatization
- Log warnings for empty documents
- Return empty result if < 2 valid documents

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 1.4: Write Comprehensive NLP Tests

**Files:**
- Create: `services/nlp/tests/test_pipeline.py`
- Create: `services/nlp/tests/test_main.py`
- Modify: `services/nlp/requirements.txt` (add pytest-cov)

**Step 1: Update requirements.txt**

```bash
# services/nlp/requirements.txt (add at end)
pytest-cov==6.0.0
```

**Step 2: Create comprehensive pipeline tests**

```python
# services/nlp/tests/test_pipeline.py
import pytest
from pipeline import analyze_corpus, lemmatize_text, get_nlp

def test_analyze_corpus_french():
    """Test French corpus analysis"""
    texts = [
        "Le certificat d'économies d'énergie est important pour la rénovation",
        "Les CEE permettent des économies d'énergie significatives",
        "La délégation CEE est essentielle pour les entreprises"
    ]
    result = analyze_corpus(texts, "fr")

    assert isinstance(result, dict)
    assert "terms" in result
    assert "terms_to_avoid" in result
    assert len(result["terms"]) > 0

    # Verify term structure
    term = result["terms"][0]
    assert "term" in term
    assert "min_occurrences" in term
    assert "max_occurrences" in term
    assert "importance" in term
    assert "term_type" in term

def test_analyze_empty_corpus():
    """Test empty corpus handling"""
    result = analyze_corpus([], "fr")
    assert result["terms"] == []
    assert result["terms_to_avoid"] == []

def test_analyze_single_document():
    """Test single document (should fail gracefully)"""
    result = analyze_corpus(["single text"], "fr")
    assert result["terms"] == []

def test_unsupported_language():
    """Test unsupported language"""
    with pytest.raises(ValueError, match="Unsupported language"):
        analyze_corpus(["test"], "xx")

def test_lemmatize_text_french():
    """Test French lemmatization"""
    text = "Les certificats d'économies d'énergie"
    tokens = lemmatize_text(text, "fr")
    # Should contain lemmatized forms
    assert len(tokens) > 0
    assert any("certificat" in t or "economie" in t or "energie" in t for t in tokens)

@pytest.mark.parametrize("language", ["fr", "en", "it", "de", "es"])
def test_model_loading(language):
    """Test spaCy model loading for all languages"""
    nlp = get_nlp(language)
    assert nlp is not None
    assert nlp.lang in ["fr", "en", "it", "de", "es"]

def test_performance():
    """Test analysis completes in reasonable time"""
    import time
    texts = ["sample text for testing performance"] * 10
    start = time.time()
    result = analyze_corpus(texts, "fr")
    duration = time.time() - start

    assert duration < 5.0  # Must complete in < 5s
    assert len(result["terms"]) > 0
```

**Step 3: Create API endpoint tests**

```python
# services/nlp/tests/test_main.py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    """Test basic health check"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_health_ready_endpoint():
    """Test readiness check"""
    response = client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert "models_loaded" in data
    assert "timestamp" in data

def test_analyze_endpoint():
    """Test analyze endpoint with valid data"""
    response = client.post("/analyze", json={
        "texts": [
            "Le certificat d'économies d'énergie",
            "Les CEE pour la rénovation énergétique"
        ],
        "language": "fr"
    })
    assert response.status_code == 200
    data = response.json()
    assert "terms" in data
    assert "terms_to_avoid" in data

def test_analyze_missing_texts():
    """Test analyze without texts"""
    response = client.post("/analyze", json={
        "language": "fr"
    })
    assert response.status_code == 422  # Validation error

def test_analyze_invalid_language():
    """Test analyze with invalid language"""
    response = client.post("/analyze", json={
        "texts": ["test"],
        "language": "invalid"
    })
    assert response.status_code == 500
```

**Step 4: Run tests with coverage**

```bash
cd services/nlp
pytest --cov=. --cov-report=term --cov-report=html
```

Expected: All tests pass, coverage >85%

**Step 5: Commit**

```bash
git add services/nlp/tests/ services/nlp/requirements.txt
git commit -m "test(nlp): add comprehensive test suite

Tests added:
- Pipeline: corpus analysis, empty corpus, unsupported language
- Lemmatization: French text processing
- Model loading: all 5 languages
- Performance: < 5s for 10 documents
- API: health checks, /analyze endpoint, validation

Coverage target: >85%

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Phase 2: Security & Validation (Days 3-4)

#### Task 2.1: Install Dependencies and Create Schemas

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/schemas.ts`

**Step 1: Install Zod**

```bash
cd apps/web
pnpm add zod
```

**Step 2: Create validation schemas**

```typescript
// apps/web/src/lib/schemas.ts
import { z } from 'zod'

// SERP Analysis Request
export const AnalyzeRequestSchema = z.object({
  keyword: z.string().min(1, "Keyword required").max(200, "Keyword too long"),
  language: z.enum(['fr', 'en', 'it', 'de', 'es'], {
    errorMap: () => ({ message: "Invalid language" })
  }),
  searchEngine: z.string().url("Invalid search engine URL"),
  guideId: z.string().uuid("Invalid guide ID"),
})

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>

// Create Guide Request
export const CreateGuideSchema = z.object({
  keyword: z.string().min(1).max(200),
  language: z.enum(['fr', 'en', 'it', 'de', 'es']).default('fr'),
  searchEngine: z.string().url().default('https://google.fr'),
})

export type CreateGuideRequest = z.infer<typeof CreateGuideSchema>

// Update Guide Request
export const UpdateGuideSchema = z.object({
  content: z.any(), // TipTap JSON schema
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(158).optional(),
})

export type UpdateGuideRequest = z.infer<typeof UpdateGuideSchema>
```

**Step 3: Write schema tests**

```typescript
// apps/web/src/lib/__tests__/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { AnalyzeRequestSchema, CreateGuideSchema } from '../schemas'

describe('AnalyzeRequestSchema', () => {
  it('validates correct data', () => {
    const data = {
      keyword: 'test keyword',
      language: 'fr' as const,
      searchEngine: 'https://google.fr',
      guideId: '123e4567-e89b-12d3-a456-426614174000',
    }
    const result = AnalyzeRequestSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects invalid language', () => {
    const data = {
      keyword: 'test',
      language: 'invalid',
      searchEngine: 'https://google.fr',
      guideId: '123e4567-e89b-12d3-a456-426614174000',
    }
    const result = AnalyzeRequestSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects keyword > 200 chars', () => {
    const data = {
      keyword: 'a'.repeat(201),
      language: 'fr' as const,
      searchEngine: 'https://google.fr',
      guideId: '123e4567-e89b-12d3-a456-426614174000',
    }
    const result = AnalyzeRequestSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID', () => {
    const data = {
      keyword: 'test',
      language: 'fr' as const,
      searchEngine: 'https://google.fr',
      guideId: 'not-a-uuid',
    }
    const result = AnalyzeRequestSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
```

**Step 4: Run tests**

```bash
pnpm test schemas
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/lib/schemas.ts apps/web/src/lib/__tests__/schemas.test.ts
git commit -m "feat(web): add Zod validation schemas

Schemas added:
- AnalyzeRequestSchema: validate SERP analysis requests
- CreateGuideSchema: validate guide creation
- UpdateGuideSchema: validate guide updates

All schemas include proper error messages and type inference

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 2.2: Add Rate Limiting with Upstash Redis

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/rate-limit.ts`

**Step 1: Install Upstash packages**

```bash
cd apps/web
pnpm add @upstash/ratelimit @upstash/redis
```

**Step 2: Create rate limiting module**

```typescript
// apps/web/src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client (will use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env)
const redis = Redis.fromEnv()

// SERP Analysis rate limit: 5 analyses per hour (expensive operation)
export const serpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: true,
  prefix: 'serpmantic:serp',
})

// General API rate limit: 100 requests per minute
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'serpmantic:api',
})

// Helper to get user identifier
export function getUserIdentifier(request: Request): string {
  // Try to get user ID from session (would need to parse auth)
  // For now, fallback to IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0] ?? 'unknown'
  return ip
}
```

**Step 3: Write rate limit tests (mock)**

```typescript
// apps/web/src/lib/__tests__/rate-limit.test.ts
import { describe, it, expect } from 'vitest'
import { getUserIdentifier } from '../rate-limit'

describe('Rate Limiting', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    })
    const identifier = getUserIdentifier(request)
    expect(identifier).toBe('192.168.1.1')
  })

  it('returns unknown when no IP header', () => {
    const request = new Request('http://localhost')
    const identifier = getUserIdentifier(request)
    expect(identifier).toBe('unknown')
  })
})
```

**Step 4: Run tests**

```bash
pnpm test rate-limit
```

Expected: Tests pass

**Step 5: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/lib/rate-limit.ts apps/web/src/lib/__tests__/rate-limit.test.ts
git commit -m "feat(web): add Upstash Redis rate limiting

Rate limits:
- SERP analysis: 5 requests/hour (expensive operation)
- General API: 100 requests/minute
- Analytics enabled for monitoring

Uses IP address as identifier (x-forwarded-for header)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 2.3: Create .env.example and Environment Validation

**Files:**
- Create: `.env.example`
- Create: `apps/web/src/lib/env.ts`

**Step 1: Create .env.example**

```bash
# .env.example
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NLP Service
NLP_SERVICE_URL=http://localhost:8001
NLP_SERVICE_TIMEOUT=30000

# SERP API (SerpAPI, DataForSEO, or ValueSerp)
SERPAPI_KEY=your_serpapi_key_here

# Upstash Redis (Rate Limiting + Cache)
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA

# Sentry (Error Monitoring - Optional)
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ORG=your-org
SENTRY_PROJECT=serpmantic
SENTRY_AUTH_TOKEN=your-auth-token

# Environment
NODE_ENV=development
```

**Step 2: Create environment validation**

```typescript
// apps/web/src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NLP_SERVICE_URL: z.string().url(),
  SERPAPI_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

export function validateEnv() {
  try {
    envSchema.parse(process.env)
    console.log('✅ Environment variables validated')
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    throw new Error('Invalid environment configuration')
  }
}

// Call on app startup (skip in tests)
if (process.env.NODE_ENV !== 'test') {
  validateEnv()
}
```

**Step 3: Commit**

```bash
git add .env.example apps/web/src/lib/env.ts
git commit -m "feat: add environment variable documentation and validation

- .env.example documents all required env vars
- env.ts validates required vars at startup
- Fails fast with clear error if misconfigured

Required vars:
- Supabase (URL, anon key)
- NLP service (URL)
- SerpAPI (key)
- Upstash Redis (URL, token)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 2.4: Integrate Validation and Rate Limiting in API Routes

**Files:**
- Modify: `apps/web/src/app/api/serp/analyze/route.ts`

**Step 1: Write failing test for validation**

```typescript
// apps/web/src/app/api/serp/analyze/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/server')
vi.mock('@/lib/serp')
vi.mock('@/lib/crawler')
vi.mock('@/lib/rate-limit')

describe('/api/serp/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 if keyword is missing', async () => {
    const request = new NextRequest('http://localhost/api/serp/analyze', {
      method: 'POST',
      body: JSON.stringify({ guideId: 'test-uuid' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Validation')
  })

  it('returns 400 for invalid language', async () => {
    const request = new NextRequest('http://localhost/api/serp/analyze', {
      method: 'POST',
      body: JSON.stringify({
        keyword: 'test',
        language: 'invalid',
        searchEngine: 'https://google.fr',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test route
```

Expected: Tests fail (validation not yet integrated)

**Step 3: Integrate validation and rate limiting**

```typescript
// apps/web/src/app/api/serp/analyze/route.ts (update POST function)
import { AnalyzeRequestSchema } from '@/lib/schemas'
import { serpRateLimit, getUserIdentifier } from '@/lib/rate-limit'
import { ZodError } from 'zod'

export async function POST(request: NextRequest) {
  try {
    // 1. Validate request body
    const body = await request.json()
    const validatedData = AnalyzeRequestSchema.parse(body)
    const { keyword, language, searchEngine, guideId } = validatedData

    // 2. Rate limiting check
    const identifier = getUserIdentifier(request)
    const { success, limit, remaining, reset } = await serpRateLimit.limit(identifier)

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit,
          remaining,
          reset: new Date(reset).toISOString()
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          }
        }
      )
    }

    // ... rest of existing logic ...

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    // ... existing error handling ...
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test route
```

Expected: Tests pass

**Step 5: Commit**

```bash
git add apps/web/src/app/api/serp/analyze/route.ts apps/web/src/app/api/serp/analyze/__tests__/route.test.ts
git commit -m "feat(api): add validation and rate limiting to SERP analyze

Changes:
- Validate request body with Zod schema
- Check rate limit before processing (5 req/hour)
- Return 400 with details on validation error
- Return 429 with rate limit headers on exceeded

Tests added for both validation and rate limiting

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Phase 3: Performance Optimizations (Day 5)

#### Task 3.1: Implement Redis Caching for SERP Results

**Files:**
- Create: `apps/web/src/lib/cache.ts`
- Modify: `apps/web/src/app/api/serp/analyze/route.ts`

**Step 1: Create cache module**

```typescript
// apps/web/src/lib/cache.ts
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const SERP_CACHE_TTL = 86400 // 24 hours in seconds

export async function getCachedSerpAnalysis(
  keyword: string,
  language: string
): Promise<any | null> {
  const key = `serp:analysis:${language}:${keyword.toLowerCase()}`
  try {
    return await redis.get(key)
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

export async function setCachedSerpAnalysis(
  keyword: string,
  language: string,
  data: any
): Promise<void> {
  const key = `serp:analysis:${language}:${keyword.toLowerCase()}`
  try {
    await redis.setex(key, SERP_CACHE_TTL, data)
  } catch (error) {
    console.error('Cache set error:', error)
    // Don't throw - cache failure shouldn't break the app
  }
}

export async function invalidateSerpCache(
  keyword: string,
  language: string
): Promise<void> {
  const key = `serp:analysis:${language}:${keyword.toLowerCase()}`
  try {
    await redis.del(key)
  } catch (error) {
    console.error('Cache invalidation error:', error)
  }
}
```

**Step 2: Write cache tests**

```typescript
// apps/web/src/lib/__tests__/cache.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getCachedSerpAnalysis, setCachedSerpAnalysis } from '../cache'

// Mock Upstash Redis
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    }),
  },
}))

describe('Cache', () => {
  it('returns null for cache miss', async () => {
    const result = await getCachedSerpAnalysis('test', 'fr')
    expect(result).toBeNull()
  })

  it('handles cache set without throwing', async () => {
    const data = { analysis: {}, pages: [], terms: [] }
    // Should not throw
    await expect(setCachedSerpAnalysis('test', 'fr', data)).resolves.not.toThrow()
  })
})
```

**Step 3: Integrate cache in SERP analyze route**

```typescript
// apps/web/src/app/api/serp/analyze/route.ts (add after rate limiting)
import { getCachedSerpAnalysis, setCachedSerpAnalysis } from '@/lib/cache'

    // 3. Check cache first
    const cached = await getCachedSerpAnalysis(keyword, language)
    if (cached) {
      console.log('✅ Cache hit for:', keyword, language)
      return NextResponse.json(cached)
    }

    console.log('❌ Cache miss, performing SERP analysis...')

    // ... existing SERP analysis logic ...

    // Before returning, cache the result
    const result = {
      analysis,
      pages: savedPages,
      terms: savedTerms,
    }

    await setCachedSerpAnalysis(keyword, language, result)

    return NextResponse.json(result)
```

**Step 4: Run tests**

```bash
pnpm test cache
```

Expected: Tests pass

**Step 5: Commit**

```bash
git add apps/web/src/lib/cache.ts apps/web/src/lib/__tests__/cache.test.ts apps/web/src/app/api/serp/analyze/route.ts
git commit -m "feat(web): add Redis caching for SERP results

Cache strategy:
- 24h TTL for SERP analysis results
- Cache key: serp:analysis:{lang}:{keyword}
- Graceful degradation on cache errors

Performance impact:
- Cache hit: <100ms (vs 10-20s)
- Saves SerpAPI costs on repeated queries

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 3.2: Optimize Supabase Queries (N+1 → JOIN)

**Files:**
- Modify: `apps/web/src/app/api/guides/[id]/route.ts`

**Step 1: Write test for optimized query**

```typescript
// apps/web/src/app/api/guides/[id]/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server')

describe('/api/guides/[id]', () => {
  it('fetches guide with single query (JOIN)', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'test-id',
        keyword: 'test',
        serp_analyses: [{
          id: 'analysis-id',
          serp_pages: [],
          semantic_terms: []
        }]
      },
      error: null
    })

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })
    } as any)

    const request = new NextRequest('http://localhost/api/guides/test-id')
    await GET(request, { params: { id: 'test-id' } })

    // Verify only one query with nested select
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('serp_analyses'))
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test guides
```

Expected: Test fails (still using N+1 queries)

**Step 3: Optimize query with JOIN**

```typescript
// apps/web/src/app/api/guides/[id]/route.ts (replace GET function)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Single query with JOINs instead of N+1
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
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
    }

    // Transform nested structure for easier consumption
    const guide = data
    const analysis = data.serp_analyses?.[0] || null
    const pages = analysis?.serp_pages || []
    const terms = analysis?.semantic_terms || []

    return NextResponse.json({
      guide: {
        ...guide,
        serp_analyses: undefined, // Remove nested structure
      },
      analysis: analysis ? {
        ...analysis,
        serp_pages: undefined,
        semantic_terms: undefined,
      } : null,
      pages,
      terms,
    })
  } catch (error) {
    console.error('Failed to fetch guide:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test guides
```

Expected: Test passes

**Step 5: Commit**

```bash
git add apps/web/src/app/api/guides/[id]/route.ts apps/web/src/app/api/guides/[id]/__tests__/route.test.ts
git commit -m "perf(api): optimize Supabase queries with JOINs

Before: 4 sequential queries (~400-600ms)
After: 1 query with nested select (~100-150ms)

Performance improvement: 4x faster
Database round-trips: 4 → 1

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 3.3: Add Skeleton Loading States

**Files:**
- Create: `apps/web/src/components/dashboard/guide-card-skeleton.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create GuideCardSkeleton component**

```typescript
// apps/web/src/components/dashboard/guide-card-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function GuideCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex justify-between mt-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Integrate in dashboard**

```typescript
// apps/web/src/app/(dashboard)/dashboard/page.tsx (update)
import { GuideCardSkeleton } from '@/components/dashboard/guide-card-skeleton'

export default function DashboardPage() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)

  // ... existing useEffect ...

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Mes guides</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GuideCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // ... existing return ...
}
```

**Step 3: Test skeleton rendering**

```bash
pnpm dev
# Navigate to dashboard and verify skeletons appear while loading
```

Expected: Skeletons show while data loads, then fade to actual cards

**Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/guide-card-skeleton.tsx apps/web/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(ui): add skeleton loading states for dashboard

- GuideCardSkeleton component matches card structure
- Shows 6 skeletons while loading
- Better UX than blank screen or spinner

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 3.4: Optimize TipTap Editor Performance

**Files:**
- Modify: `apps/web/src/components/editor/toolbar.tsx`
- Modify: `apps/web/src/components/editor/tiptap-editor.tsx`

**Step 1: Memoize Toolbar component**

```typescript
// apps/web/src/components/editor/toolbar.tsx (wrap with memo)
import { memo } from 'react'
import type { Editor } from '@tiptap/react'

export const Toolbar = memo(function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  // ... existing toolbar code ...

  return (
    <div className="toolbar">
      {/* ... existing buttons ... */}
    </div>
  )
})
```

**Step 2: Increase debounce for score calculation**

```typescript
// apps/web/src/components/editor/tiptap-editor.tsx (update debounce)
const SCORE_DEBOUNCE = 800 // instead of 500ms

useEffect(() => {
  if (!editor) return

  const handleUpdate = () => {
    const text = editor.getText()
    const json = editor.getJSON()

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce score recalculation
    debounceRef.current = setTimeout(() => {
      recalculateScore(text, json)
    }, SCORE_DEBOUNCE)
  }

  editor.on('update', handleUpdate)
  return () => {
    editor.off('update', handleUpdate)
  }
}, [editor, recalculateScore])
```

**Step 3: Test editor performance**

```bash
pnpm dev
# Open editor and type quickly - verify scoring doesn't slow typing
```

Expected: Typing remains smooth, score updates after 800ms pause

**Step 4: Commit**

```bash
git add apps/web/src/components/editor/toolbar.tsx apps/web/src/components/editor/tiptap-editor.tsx
git commit -m "perf(editor): optimize TipTap editor performance

Optimizations:
- Memoize Toolbar component to prevent unnecessary re-renders
- Increase score debounce to 800ms (from 500ms)
- Reduce CPU usage during typing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Week 2: Monitoring, Tests & CI/CD

### Phase 4: Monitoring with Sentry (Days 6-7)

#### Task 4.1: Install and Configure Sentry

**Files:**
- Modify: `apps/web/package.json`
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `instrumentation.ts`

**Step 1: Install Sentry**

```bash
cd apps/web
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Follow wizard prompts:
- Select project
- Configure source maps upload
- Add SENTRY_DSN to .env

**Step 2: Configure server-side Sentry**

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  debug: false,

  // Ignore common errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],

  // Performance monitoring
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ['localhost', /^https:\/\/[^/]*\.vercel\.app/],
    }),
  ],
})
```

**Step 3: Verify Sentry integration**

```bash
pnpm dev
# Trigger an error and verify it appears in Sentry dashboard
```

Expected: Error captured and visible in Sentry

**Step 4: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml sentry.*.config.ts instrumentation.ts
git commit -m "feat(monitoring): add Sentry error monitoring

Configuration:
- Client, server, and edge Sentry configs
- Trace sampling at 100% (adjust in production)
- Ignore common false-positive errors
- Performance monitoring enabled

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 4.2: Create Monitoring Helpers

**Files:**
- Create: `apps/web/src/lib/monitoring.ts`

**Step 1: Create monitoring module**

```typescript
// apps/web/src/lib/monitoring.ts
import * as Sentry from '@sentry/nextjs'

export function captureApiError(error: Error, context: {
  route: string
  userId?: string
  payload?: any
}) {
  Sentry.captureException(error, {
    tags: {
      route: context.route,
      type: 'api_error',
    },
    user: context.userId ? { id: context.userId } : undefined,
    extra: {
      payload: context.payload,
    },
  })
}

export function trackSerpAnalysis(params: {
  keyword: string
  language: string
  duration: number
  success: boolean
  cacheHit?: boolean
}) {
  Sentry.addBreadcrumb({
    category: 'serp_analysis',
    message: `SERP analysis ${params.success ? 'succeeded' : 'failed'}`,
    level: params.success ? 'info' : 'error',
    data: {
      keyword: params.keyword,
      language: params.language,
      duration: params.duration,
      cacheHit: params.cacheHit,
    },
  })

  // Track as transaction for performance monitoring
  const transaction = Sentry.startTransaction({
    op: 'serp.analysis',
    name: 'SERP Analysis',
    data: params,
  })
  transaction.finish()
}

export function captureNlpError(error: Error, context: {
  language: string
  numTexts: number
}) {
  Sentry.captureException(error, {
    tags: {
      service: 'nlp',
      language: context.language,
    },
    extra: {
      numTexts: context.numTexts,
    },
  })
}
```

**Step 2: Integrate in SERP analyze route**

```typescript
// apps/web/src/app/api/serp/analyze/route.ts (add monitoring)
import { trackSerpAnalysis, captureApiError } from '@/lib/monitoring'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // ... existing validation, rate limiting ...

    // Check cache
    const cached = await getCachedSerpAnalysis(keyword, language)
    if (cached) {
      trackSerpAnalysis({
        keyword,
        language,
        duration: Date.now() - startTime,
        success: true,
        cacheHit: true,
      })
      return NextResponse.json(cached)
    }

    // ... existing SERP analysis ...

    trackSerpAnalysis({
      keyword,
      language,
      duration: Date.now() - startTime,
      success: true,
      cacheHit: false,
    })

    return NextResponse.json(result)
  } catch (error) {
    captureApiError(error as Error, {
      route: '/api/serp/analyze',
      payload: { keyword: keyword || 'unknown', language: language || 'unknown' },
    })

    trackSerpAnalysis({
      keyword: keyword || 'unknown',
      language: language || 'unknown',
      duration: Date.now() - startTime,
      success: false,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/monitoring.ts apps/web/src/app/api/serp/analyze/route.ts
git commit -m "feat(monitoring): add Sentry tracking helpers

Helpers added:
- captureApiError: structured API error capture
- trackSerpAnalysis: performance tracking for SERP analysis
- captureNlpError: NLP service error tracking

Integrated in /api/serp/analyze with breadcrumbs and transactions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 4.3: Add React Error Boundaries

**Files:**
- Create: `apps/web/src/components/error-boundary.tsx`
- Modify: `apps/web/src/app/(editor)/guide/[id]/page.tsx`

**Step 1: Create ErrorBoundary component**

```typescript
// apps/web/src/components/error-boundary.tsx
'use client'

import * as Sentry from '@sentry/nextjs'
import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    Sentry.captureException(error, {
      extra: errorInfo,
      tags: { boundary: 'react' },
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Quelque chose s'est mal passé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Une erreur inattendue s'est produite. L'équipe technique a été notifiée.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              )}
              <Button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="w-full"
              >
                Réessayer
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

**Step 2: Integrate in guide editor**

```typescript
// apps/web/src/app/(editor)/guide/[id]/page.tsx (wrap with ErrorBoundary)
import { ErrorBoundary } from '@/components/error-boundary'

export default function GuidePage({ params }: { params: { id: string } }) {
  return (
    <ErrorBoundary>
      <GuideEditor guideId={params.id} />
    </ErrorBoundary>
  )
}
```

**Step 3: Test error boundary**

Create a component that throws an error and verify:
- Error caught and displayed
- Sentry receives the error
- User can click "Réessayer"

**Step 4: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx apps/web/src/app/(editor)/guide/[id]/page.tsx
git commit -m "feat(ui): add React error boundaries with Sentry

- ErrorBoundary component catches React errors
- Automatic Sentry reporting
- User-friendly error UI with retry option
- Dev mode shows error stack

Integrated in guide editor page

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Phase 5: Comprehensive Testing (Days 8-9)

#### Task 5.1: Configure Vitest with Coverage

**Files:**
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`

**Step 1: Install coverage dependencies**

```bash
cd apps/web
pnpm add -D @vitest/coverage-v8
```

**Step 2: Create Vitest config**

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'e2e/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
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

**Step 3: Update package.json scripts**

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

**Step 4: Run coverage**

```bash
pnpm test:coverage
```

Expected: Coverage report generated, thresholds enforced

**Step 5: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "test(web): configure Vitest with coverage thresholds

Coverage targets:
- Lines: 80%
- Functions: 80%
- Branches: 70%
- Statements: 80%

Reports: text, JSON, HTML

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 5.2: Configure Playwright for E2E Tests

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/auth.spec.ts`
- Create: `apps/web/e2e/guide-creation.spec.ts`
- Create: `apps/web/e2e/editor.spec.ts`

**Step 1: Create Playwright config**

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

**Step 2: Create auth E2E tests**

```typescript
// apps/web/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name=email]', 'test@example.com')
    await page.fill('[name=password]', 'password123')
    await page.click('button[type=submit]')

    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Mes guides')
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name=email]', 'wrong@example.com')
    await page.fill('[name=password]', 'wrongpassword')
    await page.click('button[type=submit]')

    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })
})
```

**Step 3: Create guide creation E2E test**

```typescript
// apps/web/e2e/guide-creation.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Guide Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name=email]', 'test@example.com')
    await page.fill('[name=password]', 'password123')
    await page.click('button[type=submit]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('should create guide and run SERP analysis', async ({ page }) => {
    // Create guide
    await page.click('text=Créer un guide')
    await page.fill('[name=keyword]', 'test seo')
    await page.selectOption('[name=language]', 'fr')
    await page.click('button:has-text("Créer")')

    // Should redirect to editor
    await expect(page).toHaveURL(/\/guide\/[a-f0-9-]+/)

    // Wait for SERP analysis to complete (max 60s)
    await expect(page.locator('[data-testid=score]')).toBeVisible({
      timeout: 60000,
    })

    // Verify score is displayed
    const score = await page.locator('[data-testid=score]').textContent()
    expect(parseInt(score!)).toBeGreaterThanOrEqual(0)
    expect(parseInt(score!)).toBeLessThanOrEqual(120)
  })
})
```

**Step 4: Create editor E2E test**

```typescript
// apps/web/e2e/editor.spec.ts
import { test, expect } from '@playwright/test'

test.describe('TipTap Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to editor
    await page.goto('/login')
    await page.fill('[name=email]', 'test@example.com')
    await page.fill('[name=password]', 'password123')
    await page.click('button[type=submit]')
    await page.goto('/dashboard')
    await page.click('[data-testid=guide-card]')
  })

  test('should update score in real-time', async ({ page }) => {
    const editor = page.locator('[contenteditable=true]')
    await editor.click()

    // Get initial score
    const initialScore = await page.locator('[data-testid=score]').textContent()

    // Type some text
    await editor.type('This is a test content for SEO optimization.')

    // Wait for debounce and score update
    await page.waitForTimeout(1000)

    const updatedScore = await page.locator('[data-testid=score]').textContent()
    expect(updatedScore).not.toBe(initialScore)
  })

  test('should auto-save after 3 seconds', async ({ page }) => {
    const editor = page.locator('[contenteditable=true]')
    await editor.click()
    await editor.type('Auto-save test content')

    // Wait for auto-save
    await expect(page.locator('text=Enregistré')).toBeVisible({
      timeout: 5000,
    })
  })
})
```

**Step 5: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: Tests pass (or skip if Supabase not configured)

**Step 6: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e/
git commit -m "test(e2e): add Playwright E2E test suite

Tests added:
- Authentication (login, error handling)
- Guide creation (SERP analysis flow)
- Editor (real-time scoring, auto-save)

Config:
- Retries: 2x in CI
- Screenshots on failure
- Trace on first retry

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Phase 6: CI/CD Pipeline (Day 10)

#### Task 6.1: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test-frontend:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install
        working-directory: apps/web

      - name: Lint
        run: pnpm lint
        working-directory: apps/web

      - name: Type check
        run: pnpm tsc --noEmit
        working-directory: apps/web

      - name: Run unit tests
        run: pnpm test:coverage
        working-directory: apps/web

      - name: Build Next.js app
        run: pnpm build
        working-directory: apps/web
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

  test-nlp-service:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          python -m spacy download fr_core_news_sm
          python -m spacy download en_core_web_sm
        working-directory: services/nlp

      - name: Run pytest
        run: pytest --cov=. --cov-report=xml --cov-report=term
        working-directory: services/nlp

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [lint-and-test-frontend]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install
        working-directory: apps/web

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps
        working-directory: apps/web

      - name: Run E2E tests
        run: pnpm test:e2e
        working-directory: apps/web
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 30
```

**Step 2: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: '3.8'

services:
  nlp:
    build:
      context: ./services/nlp
      dockerfile: Dockerfile
    ports:
      - "8001:8001"
    environment:
      - LOG_LEVEL=info
      - PYTHONUNBUFFERED=1
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 3s
      retries: 3
    restart: unless-stopped
```

**Step 3: Test CI locally (optional)**

```bash
# Install act (GitHub Actions local runner)
brew install act

# Run CI locally
act -j lint-and-test-frontend
```

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml docker-compose.yml
git commit -m "ci: add GitHub Actions CI/CD pipeline

Jobs:
- lint-and-test-frontend: lint, type check, tests, build
- test-nlp-service: pytest with coverage
- e2e-tests: Playwright tests with artifact upload

Docker Compose for local development:
- NLP service with health checks
- Redis with LRU eviction policy

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Final Verification & Cleanup

#### Task 7.1: Run Full Test Suite

**Step 1: Run all tests**

```bash
# Frontend tests
cd apps/web
pnpm test:coverage

# NLP service tests
cd ../../services/nlp
pytest --cov=. --cov-report=term

# E2E tests (optional if Supabase configured)
cd ../../apps/web
pnpm test:e2e
```

**Step 2: Verify coverage thresholds**

```bash
# Check that all coverage targets are met
pnpm test:coverage
```

Expected: >80% coverage for frontend, >85% for NLP

**Step 3: Build production**

```bash
pnpm build
```

Expected: Build succeeds with no errors

**Step 4: Commit if any fixes needed**

```bash
git add .
git commit -m "chore: final test suite verification and fixes

All tests passing:
- Frontend: >80% coverage
- NLP service: >85% coverage
- E2E: all scenarios pass
- Production build: success

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### Task 7.2: Update Documentation

**Files:**
- Create: `README.md` (if not exists)
- Update: `docs/plans/2026-03-19-implementation-plan.md` (mark complete)

**Step 1: Create/update README**

```markdown
# SERPmantics

SEO content optimization tool with real-time semantic scoring.

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- pnpm 8+
- Docker (optional)

### Environment Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example apps/web/.env.local
   ```

2. Configure environment variables (see `.env.example`)

### Development

#### Frontend (Next.js)

```bash
cd apps/web
pnpm install
pnpm dev
```

#### NLP Service (Python)

```bash
cd services/nlp
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download fr_core_news_sm
uvicorn main:app --reload
```

#### Using Docker Compose

```bash
docker-compose up
```

### Testing

```bash
# Frontend tests
cd apps/web
pnpm test              # Run once
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage
pnpm test:e2e          # E2E tests

# NLP service tests
cd services/nlp
pytest
pytest --cov=.
```

### Deployment

- **Frontend**: Deploy to Vercel
- **NLP Service**: Deploy to Railway/Render using Dockerfile
- **Redis**: Use Upstash (serverless)

## Architecture

- **Frontend**: Next.js 15 + React 19 + Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth)
- **NLP**: Python FastAPI + spaCy
- **Cache**: Upstash Redis
- **Monitoring**: Sentry

## CI/CD

GitHub Actions runs on every push:
- Lint & type check
- Unit tests (>80% coverage)
- E2E tests
- Build verification

See `.github/workflows/ci.yml`
```

**Step 2: Mark implementation plan complete**

Add at top of implementation plan:

```markdown
## ✅ Implementation Status: COMPLETE

Completed: [DATE]
Duration: 10 days (2 weeks)
Final Score: 8.5/10 (from 6.5/10)

All tasks completed successfully. See commits for detailed progress.
```

**Step 3: Commit**

```bash
git add README.md docs/plans/2026-03-19-implementation-plan.md
git commit -m "docs: add README and mark implementation plan complete

README includes:
- Quick start guide
- Environment setup
- Development instructions
- Testing commands
- Deployment guide
- Architecture overview

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

### Tasks Completed

**Week 1: Critical Foundations (Days 1-5)**
- ✅ NLP Service production-ready (Dockerfile, health checks, tests)
- ✅ Security (Zod validation, rate limiting, env validation)
- ✅ Performance (Redis cache, Supabase optimization, skeleton states)

**Week 2: Monitoring, Tests & CI/CD (Days 6-10)**
- ✅ Monitoring (Sentry integration, error boundaries, tracking)
- ✅ Tests (Vitest unit tests, Playwright E2E, >80% coverage)
- ✅ CI/CD (GitHub Actions pipeline, Docker Compose)
- ✅ Documentation (README, plan updates)

### Metrics Achieved

- **Test Coverage**: >80% frontend, >85% NLP
- **Performance**: SERP cache hit <100ms (vs 10-20s)
- **Security**: Validation + rate limiting on all API routes
- **Observability**: Sentry monitoring with error boundaries
- **CI/CD**: Automated pipeline with E2E tests

### Next Steps

1. **Deploy to production**:
   - Frontend → Vercel
   - NLP service → Railway/Render
   - Configure Upstash Redis

2. **Monitor in production**:
   - Check Sentry for errors
   - Monitor rate limit analytics
   - Review performance metrics

3. **Iterate based on feedback**:
   - Adjust rate limits if needed
   - Fine-tune cache TTLs
   - Add more E2E test scenarios

---

**Plan complete and saved to `docs/plans/2026-03-19-implementation-plan.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach would you like to use?**
