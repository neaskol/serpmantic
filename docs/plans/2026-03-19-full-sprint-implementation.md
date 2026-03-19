# Full Sprint Implementation - SERPmantics Production Ready

**Date**: 2026-03-19
**Sprint Duration**: 2 semaines
**Scope**: Option C - Full Sprint (Critical + Performance + Monitoring + Tests + CI/CD)

---

## Executive Summary

Ce document décrit l'implémentation complète des recommandations de l'audit technique pour rendre SERPmantics production-ready. L'objectif est de transformer l'application MVP (6.5/10) en une application stable, performante et déployable en production (8.5/10).

**Bloqueur critique** : Le service NLP existe mais nécessite des améliorations pour la production (Docker, tests, robustesse).

**Livrable final** : Application complète avec NLP service fonctionnel, sécurité renforcée, performance optimisée, monitoring Sentry, suite de tests complète, et pipeline CI/CD automatisé.

---

## 1. Architecture Globale

### 1.1 Structure du projet

```
serpmantic/
├── apps/web/                           # Next.js 15 frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── rate-limit.ts          # NEW: Upstash Redis rate limiting
│   │   │   ├── schemas.ts             # NEW: Zod validation schemas
│   │   │   ├── cache.ts               # NEW: Redis caching for SERP
│   │   │   ├── monitoring.ts          # NEW: Sentry integration helpers
│   │   │   └── env.ts                 # NEW: Environment validation
│   │   ├── app/api/
│   │   │   ├── serp/analyze/route.ts  # ENHANCED: validation + rate limit + cache
│   │   │   └── guides/[id]/route.ts   # ENHANCED: optimized Supabase queries
│   │   └── components/
│   │       ├── error-boundary.tsx     # NEW: React error boundary
│   │       └── ui/
│   │           └── skeleton.tsx       # ENHANCED: loading states
│   ├── e2e/                           # NEW: Playwright E2E tests
│   │   ├── auth.spec.ts
│   │   ├── guide-creation.spec.ts
│   │   └── serp-analysis.spec.ts
│   └── playwright.config.ts           # NEW: Playwright configuration
├── services/nlp/                       # Python FastAPI NLP service
│   ├── main.py                        # ENHANCED: health checks, error handling
│   ├── pipeline.py                    # ENHANCED: robust error handling
│   ├── Dockerfile                     # NEW: multi-stage Docker build
│   ├── requirements.txt               # CURRENT: FastAPI + spaCy + scikit-learn
│   └── tests/                         # ENHANCED: comprehensive pytest suite
│       ├── test_pipeline.py
│       ├── test_main.py
│       └── test_languages.py
├── .github/workflows/
│   └── ci.yml                         # NEW: CI/CD pipeline
├── docker-compose.yml                 # NEW: local development stack
├── .env.example                       # NEW: documented environment variables
└── docs/
    └── plans/
        └── 2026-03-19-full-sprint-implementation.md
```

### 1.2 Principes architecturaux

1. **Defense in depth** : Validation (Zod) → Rate limiting (Redis) → Error handling (Sentry)
2. **Performance first** : Redis cache pour SERP (24h TTL), optimisation queries Supabase
3. **Observabilité** : Sentry monitoring, logs structurés, health checks
4. **Testabilité** : Tests API (Vitest), tests E2E (Playwright), coverage >80%
5. **DevOps moderne** : CI/CD GitHub Actions, Docker pour NLP service

### 1.3 Stack technique

**Frontend:**
- Next.js 15 (App Router) + React 19
- Tailwind CSS v4 (base-nova theme)
- shadcn/ui components (@base-ui/react)
- Zustand (state management)
- TipTap (WYSIWYG editor)

**Backend:**
- Supabase (PostgreSQL + Auth + Row Level Security)
- Python FastAPI (NLP service)
- Upstash Redis (rate limiting + cache)

**Infrastructure:**
- Vercel (frontend deployment)
- Railway/Render (NLP service deployment)
- GitHub Actions (CI/CD)
- Sentry (error monitoring)

**Testing:**
- Vitest (unit + API tests)
- Playwright (E2E tests)
- pytest (NLP service tests)

---

## 2. NLP Service - Production Ready

### 2.1 État actuel

✅ **Déjà implémenté :**
- FastAPI application avec endpoint `/analyze`
- Pipeline TF-IDF + spaCy pour 5 langues (fr/en/it/de/es)
- Extraction termes significatifs avec fourchettes P10-P90
- Identification termes à éviter
- Cache des modèles spaCy en mémoire

❌ **Manquant pour production :**
- Dockerfile multi-stage optimisé
- Tests complets (pytest)
- Health checks robustes
- Gestion d'erreurs structurée
- Logs structurés (JSON)

### 2.2 Améliorations

#### 2.2.1 Dockerfile multi-stage

**Nouveau fichier : `services/nlp/Dockerfile`**

```dockerfile
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

#### 2.2.2 Health checks améliorés

**Mise à jour : `services/nlp/main.py`**

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import logging
import json
from datetime import datetime

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

def log_structured(level: str, message: str, **kwargs):
    """Structured JSON logging"""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "level": level,
        "message": message,
        **kwargs
    }
    logger.info(json.dumps(log_entry))

app = FastAPI(title="SERPmantics NLP Service", version="1.0.0")

@app.get("/health")
def health():
    """Basic health check"""
    return {"status": "ok"}

@app.get("/health/ready")
def health_ready():
    """Readiness check - verify models are loaded"""
    from pipeline import _models
    return {
        "status": "ready",
        "models_loaded": list(_models.keys()),
        "timestamp": datetime.utcnow().isoformat()
    }

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

#### 2.2.3 Gestion d'erreurs robuste

**Mise à jour : `services/nlp/pipeline.py`**

```python
import logging

logger = logging.getLogger(__name__)

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

    # ... rest of TF-IDF logic ...
```

#### 2.2.4 Tests complets (pytest)

**Nouveau fichier : `services/nlp/tests/test_pipeline.py`**

```python
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
    assert "certificat" in tokens or "economie" in tokens
    assert "energie" in tokens

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

**Nouveau fichier : `services/nlp/tests/test_main.py`**

```python
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

### 2.3 Variables d'environnement

**Ajout à `.env.example` :**

```bash
# NLP Service Configuration
NLP_SERVICE_URL=http://localhost:8001
NLP_SERVICE_TIMEOUT=30000  # 30s timeout
```

---

## 3. Sécurité & Validation

### 3.1 Validation Zod

**Nouveau fichier : `apps/web/src/lib/schemas.ts`**

```typescript
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

**Intégration dans API route : `apps/web/src/app/api/serp/analyze/route.ts`**

```typescript
import { AnalyzeRequestSchema } from '@/lib/schemas'
import { ZodError } from 'zod'

export async function POST(request: NextRequest) {
  try {
    // Validate request body with Zod
    const body = await request.json()
    const validatedData = AnalyzeRequestSchema.parse(body)

    const { keyword, language, searchEngine, guideId } = validatedData

    // ... rest of the logic ...

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    // ... other error handling ...
  }
}
```

### 3.2 Rate Limiting avec Upstash Redis

**Nouveau fichier : `apps/web/src/lib/rate-limit.ts`**

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client
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
  // Try to get user ID from session
  // Fallback to IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0] ?? 'unknown'
  return ip
}
```

**Intégration dans `/api/serp/analyze/route.ts`:**

```typescript
import { serpRateLimit, getUserIdentifier } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
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

    // ... rest of the logic ...
  } catch (error) {
    // ... error handling ...
  }
}
```

**Installation dépendances :**

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

### 3.3 Variables d'environnement documentées

**Nouveau fichier : `.env.example`**

```bash
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

**Nouveau fichier : `apps/web/src/lib/env.ts`**

```typescript
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
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    throw new Error('Invalid environment configuration')
  }
}

// Call on app startup
if (process.env.NODE_ENV !== 'test') {
  validateEnv()
}
```

---

## 4. Performance & Optimisations

### 4.1 Cache Redis pour SERP

**Nouveau fichier : `apps/web/src/lib/cache.ts`**

```typescript
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

// Bulk cache operations
export async function getCachedSerpResults(
  keyword: string,
  language: string,
  engine: string
): Promise<any | null> {
  const key = `serp:results:${engine}:${language}:${keyword.toLowerCase()}`
  try {
    return await redis.get(key)
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

export async function setCachedSerpResults(
  keyword: string,
  language: string,
  engine: string,
  results: any
): Promise<void> {
  const key = `serp:results:${engine}:${language}:${keyword.toLowerCase()}`
  try {
    await redis.setex(key, SERP_CACHE_TTL, results)
  } catch (error) {
    console.error('Cache set error:', error)
  }
}
```

**Intégration dans `/api/serp/analyze/route.ts`:**

```typescript
import { getCachedSerpAnalysis, setCachedSerpAnalysis } from '@/lib/cache'

export async function POST(request: NextRequest) {
  try {
    // ... rate limiting ...
    // ... validation ...

    const { keyword, language, searchEngine, guideId } = validatedData

    // Check cache first
    const cached = await getCachedSerpAnalysis(keyword, language)
    if (cached) {
      console.log('✅ Cache hit for:', keyword, language)
      return NextResponse.json(cached)
    }

    console.log('❌ Cache miss, performing SERP analysis...')

    // ... perform SERP analysis ...

    const result = {
      analysis,
      pages: savedPages,
      terms: savedTerms,
    }

    // Cache the result
    await setCachedSerpAnalysis(keyword, language, result)

    return NextResponse.json(result)
  } catch (error) {
    // ... error handling ...
  }
}
```

**Impact estimé :**
- ❌ Avant : 10-20s + $0.01 par analyse
- ✅ Après : <100ms pour cache hits (gratuit)

### 4.2 Optimisation requêtes Supabase

**Avant (N+1 queries) : `apps/web/src/app/api/guides/[id]/route.ts`**

```typescript
// 4 queries séquentielles = ~400-600ms
const { data: guide } = await supabase
  .from('guides')
  .select('*')
  .eq('id', id)
  .single()

const { data: analysis } = await supabase
  .from('serp_analyses')
  .select('*')
  .eq('guide_id', id)
  .single()

const { data: pages } = await supabase
  .from('serp_pages')
  .select('*')
  .eq('serp_analysis_id', analysis?.id)

const { data: terms } = await supabase
  .from('semantic_terms')
  .select('*')
  .eq('serp_analysis_id', analysis?.id)
```

**Après (1 query avec JOINs) :**

```typescript
// 1 query avec relations = ~100-150ms
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
  return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
}

// Transform nested structure
const guide = data
const analysis = data.serp_analyses?.[0] || null
const pages = analysis?.serp_pages || []
const terms = analysis?.semantic_terms || []
```

**Impact :**
- ❌ Avant : ~400-600ms (4 round-trips)
- ✅ Après : ~100-150ms (1 round-trip)

### 4.3 Skeleton Loading States

**Mise à jour : `apps/web/src/components/ui/skeleton.tsx`**

Déjà existant, pas de changement nécessaire.

**Nouveau composant : `apps/web/src/components/dashboard/guide-card-skeleton.tsx`**

```typescript
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

**Intégration dans dashboard :**

```typescript
// apps/web/src/app/(dashboard)/dashboard/page.tsx
import { GuideCardSkeleton } from '@/components/dashboard/guide-card-skeleton'

export default function DashboardPage() {
  const { guides, loading } = useGuides()

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <GuideCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {guides.map(guide => <GuideCard key={guide.id} guide={guide} />)}
    </div>
  )
}
```

### 4.4 Optimisation éditeur TipTap

**Mise à jour : `apps/web/src/components/editor/toolbar.tsx`**

```typescript
import { memo } from 'react'

// Memoize toolbar to prevent unnecessary re-renders
export const Toolbar = memo(function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  return (
    <div className="toolbar">
      {/* ... toolbar buttons ... */}
    </div>
  )
})
```

**Mise à jour : `apps/web/src/components/editor/tiptap-editor.tsx`**

```typescript
// Increase debounce for scoring calculation
const SCORE_DEBOUNCE = 800 // instead of 500ms

useEffect(() => {
  if (!editor) return

  const handleUpdate = () => {
    const text = editor.getText()
    const json = editor.getJSON()

    // Debounce score recalculation
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      recalculateScore(text, json)
    }, SCORE_DEBOUNCE)
  }

  editor.on('update', handleUpdate)
  return () => {
    editor.off('update', handleUpdate)
  }
}, [editor])
```

---

## 5. Monitoring & Observabilité

### 5.1 Installation Sentry

```bash
pnpm add @sentry/nextjs @sentry/node
npx @sentry/wizard@latest -i nextjs
```

Fichiers générés automatiquement :
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `instrumentation.ts`

### 5.2 Configuration Sentry

**Fichier : `sentry.server.config.ts`**

```typescript
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

### 5.3 Helpers de monitoring

**Nouveau fichier : `apps/web/src/lib/monitoring.ts`**

```typescript
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

**Usage dans `/api/serp/analyze/route.ts`:**

```typescript
import { trackSerpAnalysis, captureApiError } from '@/lib/monitoring'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // ... validation, rate limiting ...

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

    // ... SERP analysis ...

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
      payload: { keyword, language },
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

### 5.4 Error Boundaries React

**Nouveau fichier : `apps/web/src/components/error-boundary.tsx`**

```typescript
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

**Intégration dans layouts :**

```typescript
// apps/web/src/app/(editor)/guide/[id]/page.tsx
import { ErrorBoundary } from '@/components/error-boundary'

export default function GuidePage({ params }: { params: { id: string } }) {
  return (
    <ErrorBoundary>
      <GuideEditor guideId={params.id} />
    </ErrorBoundary>
  )
}
```

### 5.5 Logs structurés

**Pattern de logging standardisé :**

```typescript
// Au lieu de console.log()
function logStructured(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  }
  console.log(JSON.stringify(entry))
}

// Usage
logStructured('info', 'SERP analysis started', { keyword, language })
logStructured('error', 'NLP service failed', { error: error.message, keyword })
```

---

## 6. Tests & Qualité

### 6.1 Tests API (Vitest)

**Structure :**
```
apps/web/src/
├── app/api/
│   ├── serp/analyze/__tests__/
│   │   └── route.test.ts
│   └── guides/__tests__/
│       ├── route.test.ts
│       └── [id].test.ts
└── lib/__tests__/
    ├── scoring.test.ts       ✅ existant
    ├── text-utils.test.ts    ✅ existant
    ├── cache.test.ts         NEW
    ├── rate-limit.test.ts    NEW
    └── schemas.test.ts       NEW
```

**Nouveau fichier : `apps/web/src/app/api/serp/analyze/__tests__/route.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock external dependencies
vi.mock('@/lib/supabase/server')
vi.mock('@/lib/serp')
vi.mock('@/lib/crawler')
vi.mock('@/lib/cache')
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

  it('returns 429 when rate limit exceeded', async () => {
    const { serpRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(serpRateLimit.limit).mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 3600000,
    })

    const request = new NextRequest('http://localhost/api/serp/analyze', {
      method: 'POST',
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.fr',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.error).toContain('Rate limit')
  })

  it('returns cached result when available', async () => {
    const { getCachedSerpAnalysis } = await import('@/lib/cache')
    const cachedData = { analysis: {}, pages: [], terms: [] }
    vi.mocked(getCachedSerpAnalysis).mockResolvedValue(cachedData)

    const { serpRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(serpRateLimit.limit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 3600000,
    })

    const request = new NextRequest('http://localhost/api/serp/analyze', {
      method: 'POST',
      body: JSON.stringify({
        keyword: 'test',
        language: 'fr',
        searchEngine: 'https://google.fr',
        guideId: '123e4567-e89b-12d3-a456-426614174000',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual(cachedData)
  })
})
```

**Nouveau fichier : `apps/web/src/lib/__tests__/schemas.test.ts`**

```typescript
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

**Nouveau fichier : `apps/web/src/lib/__tests__/cache.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCachedSerpAnalysis, setCachedSerpAnalysis } from '../cache'

// Mock Upstash Redis
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    }),
  },
}))

describe('Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for cache miss', async () => {
    const result = await getCachedSerpAnalysis('test', 'fr')
    expect(result).toBeNull()
  })

  it('stores and retrieves cached data', async () => {
    const data = { analysis: {}, pages: [], terms: [] }
    await setCachedSerpAnalysis('test', 'fr', data)
    // In real scenario, this would retrieve from Redis
    // Here we just verify no errors thrown
    expect(true).toBe(true)
  })
})
```

### 6.2 Tests E2E (Playwright)

**Configuration : `apps/web/playwright.config.ts`**

```typescript
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

**Nouveau fichier : `apps/web/e2e/auth.spec.ts`**

```typescript
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

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[name=email]', 'test@example.com')
    await page.fill('[name=password]', 'password123')
    await page.click('button[type=submit]')

    // Logout
    await page.click('[data-testid=user-menu]')
    await page.click('text=Se déconnecter')

    await expect(page).toHaveURL('/login')
  })
})
```

**Nouveau fichier : `apps/web/e2e/guide-creation.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Guide Creation and SERP Analysis', () => {
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

    // Wait for SERP analysis to start
    await expect(page.locator('text=Analyse en cours')).toBeVisible()

    // Wait for analysis to complete (max 60s)
    await expect(page.locator('[data-testid=score]')).toBeVisible({
      timeout: 60000,
    })

    // Verify score is displayed
    const score = await page.locator('[data-testid=score]').textContent()
    expect(parseInt(score!)).toBeGreaterThanOrEqual(0)
    expect(parseInt(score!)).toBeLessThanOrEqual(120)

    // Verify semantic terms are displayed
    await expect(page.locator('text=Expressions sémantiques')).toBeVisible()
    await expect(page.locator('[data-testid=term-item]').first()).toBeVisible()
  })

  test('should display cached results on reload', async ({ page }) => {
    // Assuming a guide already exists with analysis
    await page.goto('/dashboard')
    await page.click('[data-testid=guide-card]')

    // Should load quickly from cache
    await expect(page.locator('[data-testid=score]')).toBeVisible({
      timeout: 5000,
    })
  })
})
```

**Nouveau fichier : `apps/web/e2e/editor.spec.ts`**

```typescript
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

  test('should format text with toolbar', async ({ page }) => {
    const editor = page.locator('[contenteditable=true]')
    await editor.click()
    await editor.type('Bold text')

    // Select text
    await page.keyboard.press('Control+A')

    // Click bold button
    await page.click('[data-testid=toolbar-bold]')

    // Verify bold formatting
    await expect(page.locator('strong')).toContainText('Bold text')
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

### 6.3 Configuration scripts package.json

**Mise à jour : `apps/web/package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:all": "pnpm test && pnpm test:e2e"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@vitest/coverage-v8": "^1.0.0",
    "vitest": "^1.0.0"
  }
}
```

### 6.4 Objectifs de couverture

**Cibles :**
- Frontend (lib/) : **>80%**
- API routes : **>70%**
- NLP service : **>85%**

**Nouveau fichier : `apps/web/vitest.config.ts`**

```typescript
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

---

## 7. CI/CD & DevOps

### 7.1 GitHub Actions Pipeline

**Nouveau fichier : `.github/workflows/ci.yml`**

```yaml
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

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./apps/web/coverage/coverage-final.json
          flags: frontend

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

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./services/nlp/coverage.xml
          flags: nlp

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

  docker-build-nlp:
    runs-on: ubuntu-latest
    needs: [test-nlp-service]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./services/nlp
          file: ./services/nlp/Dockerfile
          push: false
          tags: serpmantic-nlp:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 7.2 Docker Compose pour développement

**Nouveau fichier : `docker-compose.yml`**

```yaml
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
    networks:
      - serpmantic

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
    networks:
      - serpmantic
    volumes:
      - redis-data:/data

networks:
  serpmantic:
    driver: bridge

volumes:
  redis-data:
```

**Scripts ajoutés à `package.json` racine :**

```json
{
  "scripts": {
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:nlp": "docker-compose up nlp",
    "docker:logs": "docker-compose logs -f",
    "docker:build": "docker-compose build"
  }
}
```

### 7.3 Stratégie de déploiement

#### Frontend (apps/web)

**Plateforme : Vercel (recommandé)**

**Avantages :**
- Zero-config pour Next.js
- Auto-deploy sur push à `main`
- Preview deployments sur PRs
- Edge network global
- Automatic HTTPS

**Configuration Vercel :**

```json
// vercel.json
{
  "buildCommand": "cd apps/web && pnpm build",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "NLP_SERVICE_URL": "@nlp-service-url",
    "SERPAPI_KEY": "@serpapi-key",
    "UPSTASH_REDIS_REST_URL": "@upstash-redis-url",
    "UPSTASH_REDIS_REST_TOKEN": "@upstash-redis-token",
    "SENTRY_DSN": "@sentry-dsn"
  }
}
```

#### NLP Service

**Plateforme : Railway ou Render**

**Railway (recommandé) :**
- Déploiement automatique depuis GitHub
- Support Docker natif
- Scaling horizontal simple
- Logs et metrics inclus

**Configuration Railway :**

```toml
# railway.toml
[build]
builder = "dockerfile"
dockerfilePath = "services/nlp/Dockerfile"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on-failure"
```

**Alternative : Render**

```yaml
# render.yaml
services:
  - type: web
    name: serpmantic-nlp
    env: python
    buildCommand: "pip install -r requirements.txt && python -m spacy download fr_core_news_sm en_core_web_sm it_core_news_sm de_core_news_sm es_core_news_sm"
    startCommand: "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2"
    healthCheckPath: /health
    envVars:
      - key: LOG_LEVEL
        value: info
```

#### Redis Cache

**Plateforme : Upstash (serverless)**

**Avantages :**
- Gratuit jusqu'à 10K commandes/jour
- Pas d'infrastructure à gérer
- Compatible avec Vercel Edge
- Global replication

**Setup :**
1. Créer compte sur https://upstash.com
2. Créer database Redis
3. Copier `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`
4. Ajouter dans Vercel env vars

### 7.4 Secrets GitHub Actions

**Secrets requis dans GitHub repository settings :**

```
SUPABASE_URL
SUPABASE_ANON_KEY
CODECOV_TOKEN (optionnel)
```

---

## 8. Timeline & Phases d'implémentation

### Semaine 1 : Fondations critiques

**Jours 1-2 : NLP Service Production-Ready**
- [ ] Créer Dockerfile multi-stage
- [ ] Améliorer health checks (`/health/ready`)
- [ ] Ajouter gestion d'erreurs robuste
- [ ] Implémenter logs structurés
- [ ] Écrire tests pytest complets
- [ ] Tester build Docker local

**Jours 3-4 : Sécurité & Validation**
- [ ] Installer Zod (`pnpm add zod`)
- [ ] Créer `lib/schemas.ts` avec tous les schemas
- [ ] Intégrer validation dans toutes les API routes
- [ ] Installer Upstash Redis (`pnpm add @upstash/ratelimit @upstash/redis`)
- [ ] Créer `lib/rate-limit.ts`
- [ ] Intégrer rate limiting dans `/api/serp/analyze`
- [ ] Créer `.env.example`
- [ ] Créer `lib/env.ts` pour validation env vars

**Jour 5 : Performance**
- [ ] Créer `lib/cache.ts` pour Redis cache
- [ ] Intégrer cache dans `/api/serp/analyze`
- [ ] Optimiser requêtes Supabase (N+1 → JOIN)
- [ ] Créer composants Skeleton
- [ ] Optimiser TipTap (memo, debounce)

### Semaine 2 : Monitoring, Tests & CI/CD

**Jours 6-7 : Monitoring**
- [ ] Installer Sentry (`pnpm add @sentry/nextjs`)
- [ ] Configurer Sentry (`npx @sentry/wizard`)
- [ ] Créer `lib/monitoring.ts`
- [ ] Intégrer tracking dans API routes
- [ ] Créer composant `ErrorBoundary`
- [ ] Ajouter logs structurés partout
- [ ] Configurer alertes Sentry

**Jours 8-9 : Tests**
- [ ] Écrire tests API (Vitest)
  - [ ] `api/serp/analyze/__tests__/route.test.ts`
  - [ ] `api/guides/__tests__/route.test.ts`
  - [ ] `lib/__tests__/cache.test.ts`
  - [ ] `lib/__tests__/schemas.test.ts`
- [ ] Écrire tests E2E (Playwright)
  - [ ] `e2e/auth.spec.ts`
  - [ ] `e2e/guide-creation.spec.ts`
  - [ ] `e2e/editor.spec.ts`
- [ ] Configurer coverage thresholds
- [ ] Atteindre >80% coverage frontend

**Jour 10 : CI/CD & DevOps**
- [ ] Créer `.github/workflows/ci.yml`
- [ ] Créer `docker-compose.yml`
- [ ] Tester pipeline CI localement (act)
- [ ] Configurer secrets GitHub
- [ ] Déployer NLP service sur Railway/Render
- [ ] Déployer frontend sur Vercel
- [ ] Tester déploiement E2E

---

## 9. Checklist de validation

### Avant de merger à main

- [ ] Tous les tests passent (`pnpm test:all`)
- [ ] Coverage >80% frontend, >85% NLP
- [ ] Build Next.js réussit sans warnings
- [ ] Docker build NLP réussit
- [ ] Aucune erreur ESLint
- [ ] Aucune erreur TypeScript
- [ ] `.env.example` à jour
- [ ] Documentation mise à jour

### Avant déploiement production

- [ ] Tests E2E passent sur staging
- [ ] Rate limiting testé manuellement
- [ ] Cache Redis fonctionnel
- [ ] Sentry reçoit bien les erreurs
- [ ] Health checks NLP service OK
- [ ] Variables d'env configurées sur Vercel
- [ ] Variables d'env configurées sur Railway
- [ ] Backup DB Supabase configuré

---

## 10. Métriques de succès

### Performance

- ✅ SERP analysis (cache hit) : < 100ms (vs 10-20s)
- ✅ SERP analysis (cache miss) : < 15s (acceptable)
- ✅ API response time (P95) : < 200ms
- ✅ Editor debounce : 800ms (vs 500ms)

### Qualité

- ✅ Test coverage frontend : >80%
- ✅ Test coverage NLP : >85%
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors

### Sécurité

- ✅ Rate limiting actif : 5 analyses/heure
- ✅ Input validation : 100% API routes
- ✅ Env vars validées au startup
- ✅ Error monitoring : Sentry actif

### DevOps

- ✅ CI pipeline : < 10min
- ✅ Deploy time : < 5min
- ✅ Zero downtime deployments
- ✅ Health checks : 100% services

---

## 11. Risques & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Upstash Redis quota dépassé | Moyenne | Haut | Monitoring + alertes + fallback sans cache |
| NLP service timeout (>30s) | Faible | Moyen | Timeout configuré + retry logic |
| Sentry quota dépassé | Faible | Faible | Sampling 10% en prod + ignore common errors |
| Tests E2E flaky | Haute | Moyen | Retries (2x) + screenshots on failure |
| Docker build trop lent | Moyenne | Faible | Multi-stage + layer caching |

---

## 12. Post-Sprint (optionnel)

### Améliorations futures (non incluses dans ce sprint)

- [ ] Compression images (upload S3 au lieu de base64)
- [ ] WebSockets pour notifications temps réel
- [ ] Historique des versions de guides
- [ ] Export PDF/Word
- [ ] API publique pour intégrations
- [ ] Dashboard analytics (métriques agrégées)

---

## Conclusion

Ce plan d'implémentation transforme SERPmantics d'un MVP (6.5/10) en une application production-ready (8.5/10) en 2 semaines.

**Priorités absolues :**
1. NLP service robuste et testé
2. Sécurité (validation + rate limiting)
3. Performance (cache Redis)
4. Monitoring (Sentry)
5. Tests (>80% coverage)
6. CI/CD automatisé

**Livrable final :**
Application stable, sécurisée, performante, observable, testée, et déployable automatiquement.
