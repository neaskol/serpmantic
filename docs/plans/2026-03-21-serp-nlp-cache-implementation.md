# SERP NLP Cache Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cache per-URL TextRazor NLP results in Supabase to reduce API calls by 70-80%.

**Architecture:** A new `nlp_cache` table in Supabase stores lemmas/entities/topics keyed by URL hash + language (7-day TTL). Before calling the NLP service, the analyze routes check the cache and only send uncached URLs. The NLP service itself remains unchanged.

**Tech Stack:** Supabase PostgreSQL, Next.js API routes, Web Crypto API (SHA-256), Vitest

---

### Task 1: Create `nlp_cache` Supabase migration

**Files:**
- Create: `supabase/migrations/008_create_nlp_cache.sql`

**Step 1: Write the migration SQL**

```sql
-- NLP result cache: stores per-URL TextRazor analysis results (7-day TTL)
-- Reduces TextRazor API calls by reusing results for URLs that appear across multiple SERP analyses

CREATE TABLE IF NOT EXISTS nlp_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash TEXT NOT NULL,
  url TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('fr', 'en', 'it', 'de', 'es')),
  lemmas JSONB NOT NULL DEFAULT '[]',
  entities JSONB NOT NULL DEFAULT '[]',
  topics JSONB NOT NULL DEFAULT '[]',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(url_hash, language)
);

-- Fast lookup by URL hash + language (primary access pattern)
CREATE INDEX idx_nlp_cache_lookup ON nlp_cache(url_hash, language);

-- For cleanup queries: find entries older than 7 days
CREATE INDEX idx_nlp_cache_expiry ON nlp_cache(analyzed_at);
```

**Step 2: Apply migration to Supabase**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic" && npx supabase db push` or apply via Supabase dashboard SQL editor.

**Step 3: Commit**

```bash
git add supabase/migrations/008_create_nlp_cache.sql
git commit -m "feat: add nlp_cache table for per-URL TextRazor result caching"
```

---

### Task 2: Create `nlp-cache.ts` module

**Files:**
- Create: `apps/web/src/lib/nlp-cache.ts`
- Test: `apps/web/src/lib/__tests__/nlp-cache.test.ts`

**Step 1: Write the failing tests**

Create `apps/web/src/lib/__tests__/nlp-cache.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hashUrl, NLP_CACHE_TTL_DAYS } from '../nlp-cache'

describe('nlp-cache', () => {
  describe('hashUrl', () => {
    it('returns consistent SHA-256 hex for a URL', async () => {
      const hash = await hashUrl('https://example.com/page')
      expect(hash).toMatch(/^[a-f0-9]{64}$/) // SHA-256 = 64 hex chars
    })

    it('returns same hash for same URL', async () => {
      const hash1 = await hashUrl('https://example.com/page')
      const hash2 = await hashUrl('https://example.com/page')
      expect(hash1).toBe(hash2)
    })

    it('normalizes URL before hashing (lowercase, trim)', async () => {
      const hash1 = await hashUrl('https://Example.COM/Page')
      const hash2 = await hashUrl('  https://example.com/page  ')
      expect(hash1).toBe(hash2)
    })

    it('returns different hashes for different URLs', async () => {
      const hash1 = await hashUrl('https://example.com/a')
      const hash2 = await hashUrl('https://example.com/b')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('NLP_CACHE_TTL_DAYS', () => {
    it('is 7 days', () => {
      expect(NLP_CACHE_TTL_DAYS).toBe(7)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx vitest run src/lib/__tests__/nlp-cache.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `nlp-cache.ts`**

Create `apps/web/src/lib/nlp-cache.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export const NLP_CACHE_TTL_DAYS = 7

export interface NlpCacheEntry {
  url: string
  url_hash: string
  language: string
  lemmas: string[]
  entities: Array<{ text: string; type: string; relevance: number }>
  topics: Array<{ label: string; score: number }>
  analyzed_at: string
}

/**
 * Hash a URL using SHA-256 for cache key lookup.
 * Normalizes URL (lowercase, trim) before hashing.
 */
export async function hashUrl(url: string): Promise<string> {
  const normalized = url.toLowerCase().trim()
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Look up NLP cache entries for a batch of URLs.
 * Returns cached results and list of uncached URLs.
 */
export async function getNlpCacheEntries(
  urls: string[],
  language: string
): Promise<{ cached: Map<string, NlpCacheEntry>; uncachedUrls: string[] }> {
  const cached = new Map<string, NlpCacheEntry>()
  const uncachedUrls: string[] = []

  if (urls.length === 0) {
    return { cached, uncachedUrls }
  }

  try {
    const supabase = await createClient()

    // Hash all URLs
    const urlHashes = await Promise.all(
      urls.map(async (url) => ({ url, hash: await hashUrl(url) }))
    )
    const hashToUrl = new Map(urlHashes.map(({ url, hash }) => [hash, url]))
    const hashes = urlHashes.map(({ hash }) => hash)

    // Query cache for all hashes at once
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - NLP_CACHE_TTL_DAYS)

    const { data, error } = await supabase
      .from('nlp_cache')
      .select('*')
      .in('url_hash', hashes)
      .eq('language', language)
      .gte('analyzed_at', cutoff.toISOString())

    if (error) {
      logger.error('NLP cache lookup failed', { error: error.message })
      // On error, treat all as uncached (graceful degradation)
      return { cached, uncachedUrls: [...urls] }
    }

    // Build set of found hashes
    const foundHashes = new Set<string>()
    if (data) {
      for (const row of data) {
        foundHashes.add(row.url_hash)
        const originalUrl = hashToUrl.get(row.url_hash) || row.url
        cached.set(originalUrl, row as NlpCacheEntry)
      }
    }

    // Determine uncached URLs
    for (const { url, hash } of urlHashes) {
      if (!foundHashes.has(hash)) {
        uncachedUrls.push(url)
      }
    }

    logger.info('NLP cache lookup', {
      total: urls.length,
      hits: cached.size,
      misses: uncachedUrls.length,
      language,
    })
  } catch (error) {
    logger.error('NLP cache lookup error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { cached, uncachedUrls: [...urls] }
  }

  return { cached, uncachedUrls }
}

/**
 * Store NLP results in cache (upsert by url_hash + language).
 */
export async function setNlpCacheEntries(
  entries: Array<{
    url: string
    language: string
    lemmas: string[]
    entities: Array<{ text: string; type: string; relevance: number }>
    topics: Array<{ label: string; score: number }>
  }>
): Promise<void> {
  if (entries.length === 0) return

  try {
    const supabase = await createClient()

    const rows = await Promise.all(
      entries.map(async (entry) => ({
        url_hash: await hashUrl(entry.url),
        url: entry.url,
        language: entry.language,
        lemmas: entry.lemmas,
        entities: entry.entities,
        topics: entry.topics,
        analyzed_at: new Date().toISOString(),
      }))
    )

    const { error } = await supabase
      .from('nlp_cache')
      .upsert(rows, { onConflict: 'url_hash,language' })

    if (error) {
      logger.error('NLP cache store failed', { error: error.message })
    } else {
      logger.info('NLP cache entries stored', { count: rows.length })
    }
  } catch (error) {
    logger.error('NLP cache store error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Delete expired NLP cache entries (older than TTL).
 * Returns number of deleted rows.
 */
export async function cleanExpiredNlpCache(): Promise<number> {
  try {
    const supabase = await createClient()

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - NLP_CACHE_TTL_DAYS)

    const { data, error } = await supabase
      .from('nlp_cache')
      .delete()
      .lt('analyzed_at', cutoff.toISOString())
      .select('id')

    if (error) {
      logger.error('NLP cache cleanup failed', { error: error.message })
      return 0
    }

    const count = data?.length || 0
    logger.info('NLP cache cleanup', { deleted: count })
    return count
  } catch (error) {
    logger.error('NLP cache cleanup error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx vitest run src/lib/__tests__/nlp-cache.test.ts`
Expected: PASS (hashUrl and constant tests)

**Step 5: Commit**

```bash
git add apps/web/src/lib/nlp-cache.ts apps/web/src/lib/__tests__/nlp-cache.test.ts
git commit -m "feat: add nlp-cache module with URL hashing and Supabase CRUD"
```

---

### Task 3: Integrate NLP cache into `analyze/route.ts`

**Files:**
- Modify: `apps/web/src/app/api/serp/analyze/route.ts` (lines 224-248 — NLP service call)

**Step 1: Add import at top of file**

Add after existing imports (line 10):
```typescript
import { getNlpCacheEntries, setNlpCacheEntries } from '@/lib/nlp-cache'
```

**Step 2: Replace the NLP call section (lines 224-248)**

Replace the block from `// 6. Send texts to NLP service` through the nlpData logging with:

```typescript
    // 6. Check NLP cache and send only uncached texts to NLP service
    logger.info('Checking NLP cache', {
      language: lang,
      numPages: crawledPages.length,
    })

    const crawledUrls = crawledPages.map(p => p.url)
    const { cached: nlpCached, uncachedUrls } = await getNlpCacheEntries(crawledUrls, lang)

    let allLemmaLists: string[][] = []
    let nlpCallsMade = 0

    if (uncachedUrls.length > 0) {
      // Build texts for uncached URLs only
      const uncachedPages = crawledPages.filter(p => uncachedUrls.includes(p.url))

      logger.info('Calling NLP service for uncached URLs', {
        cached: nlpCached.size,
        uncached: uncachedPages.length,
        total: crawledPages.length,
      })

      const nlpStartTime = Date.now()
      const nlpResponse = await fetch(`${process.env.NLP_SERVICE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: uncachedPages.map(p => p.text),
          language: lang,
        }),
      })

      if (!nlpResponse.ok) {
        throw new Error(`NLP service returned ${nlpResponse.status}`)
      }

      const nlpData = await nlpResponse.json()
      nlpCallsMade = uncachedPages.length

      logger.info('NLP analysis completed', {
        termsFound: nlpData.terms?.length || 0,
        termsToAvoid: nlpData.terms_to_avoid?.length || 0,
        duration: Date.now() - nlpStartTime,
      })

      // Store fresh results in NLP cache
      // We need per-URL lemmas — re-analyze individually for caching
      // But the current NLP service returns aggregated results, not per-URL
      // So we cache at the corpus level for now via the existing Redis L1 cache
      // and store individual URL lemmas from the NLP service response

      // For now, use the aggregated NLP data directly (same as before)
      // The cache benefit comes from skipping the NLP call entirely when ALL URLs are cached
    } else {
      logger.info('All URLs found in NLP cache, skipping NLP service call', {
        cached: nlpCached.size,
      })
    }

    // Build NLP data from cache + fresh results
    // When we have cached data for ALL URLs, reconstruct from cached lemmas
    let nlpData: { terms: any[]; terms_to_avoid: string[] }

    if (uncachedUrls.length === 0) {
      // All cached — reconstruct from cached lemma lists
      const lemmaLists = crawledPages.map(p => {
        const entry = nlpCached.get(p.url)
        return entry ? (entry.lemmas as string[]) : []
      })

      // Re-run the aggregation logic locally (term frequencies, percentiles)
      nlpData = aggregateNlpResults(lemmaLists)
    } else if (nlpCached.size === 0) {
      // None cached — use fresh NLP response directly (original flow)
      const nlpResponse = await fetch(`${process.env.NLP_SERVICE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: crawledPages.map(p => p.text),
          language: lang,
        }),
      })

      if (!nlpResponse.ok) {
        throw new Error(`NLP service returned ${nlpResponse.status}`)
      }

      nlpData = await nlpResponse.json()
    } else {
      // Partial cache — need to send uncached to NLP for per-URL lemmas,
      // then combine with cached lemmas and re-aggregate
      // This requires the NLP service to return per-URL lemmas (see Task 4)
      const uncachedPages = crawledPages.filter(p => uncachedUrls.includes(p.url))

      const nlpResponse = await fetch(`${process.env.NLP_SERVICE_URL}/analyze-with-lemmas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: uncachedPages.map(p => p.text),
          language: lang,
        }),
      })

      if (!nlpResponse.ok) {
        throw new Error(`NLP service returned ${nlpResponse.status}`)
      }

      const freshData = await nlpResponse.json()

      // Cache fresh per-URL lemmas
      const cacheEntries = uncachedPages.map((page, i) => ({
        url: page.url,
        language: lang,
        lemmas: freshData.per_url_lemmas[i] || [],
        entities: freshData.per_url_entities?.[i] || [],
        topics: freshData.per_url_topics?.[i] || [],
      }))
      await setNlpCacheEntries(cacheEntries)

      // Combine cached + fresh lemma lists in original page order
      const allLemmas = crawledPages.map(p => {
        const cachedEntry = nlpCached.get(p.url)
        if (cachedEntry) return cachedEntry.lemmas as string[]
        const freshIdx = uncachedPages.findIndex(up => up.url === p.url)
        return freshData.per_url_lemmas[freshIdx] || []
      })

      nlpData = aggregateNlpResults(allLemmas)
    }
```

**WAIT** — this approach is getting complex because the current NLP service returns **aggregated** results, not per-URL lemmas. The design needs a small NLP service change.

I'll restructure the plan to account for this.

---

### Task 3 (revised): Add `/analyze-with-lemmas` endpoint to NLP service

**Files:**
- Modify: `services/nlp/main.py`
- Modify: `services/nlp/textrazor_pipeline.py`

**Step 1: Add `analyze_corpus_with_lemmas` function to `textrazor_pipeline.py`**

Add at the end of `services/nlp/textrazor_pipeline.py`:

```python
def analyze_corpus_with_lemmas(texts: List[str], language: str = "fr") -> dict:
    """
    Same as analyze_corpus but also returns per-document lemma lists
    for caching individual URL results.
    """
    if not texts:
        return {"terms": [], "terms_to_avoid": [], "per_url_lemmas": [], "per_url_entities": [], "per_url_topics": []}

    if language not in ["fr", "en", "it", "de", "es"]:
        raise ValueError(f"Unsupported language: {language}")

    if len(texts) < 2:
        return {"terms": [], "terms_to_avoid": [], "per_url_lemmas": [], "per_url_entities": [], "per_url_topics": []}

    logger.info(f"Analyzing {len(texts)} documents with TextRazor (language: {language})")

    lemma_lists = []
    all_entities_per_url = []
    all_topics_per_url = []

    for i, text in enumerate(texts):
        try:
            max_bytes = 200 * 1024
            text_bytes = text.encode('utf-8')
            if len(text_bytes) > max_bytes:
                text = text_bytes[:max_bytes].decode('utf-8', errors='ignore')
                logger.warning(f"Document {i+1} truncated to 200KB")

            result = analyze_text_with_textrazor(text, language)
            lemma_lists.append(result["lemmas"])
            all_entities_per_url.append(result["entities"])
            all_topics_per_url.append(result["topics"])

            logger.info(f"Document {i+1}/{len(texts)}: {len(result['lemmas'])} lemmas extracted")

        except Exception as e:
            logger.error(f"Failed to analyze document {i+1}: {e}")
            lemma_lists.append([])
            all_entities_per_url.append([])
            all_topics_per_url.append([])

    # Reuse existing aggregation logic
    term_frequencies = calculate_term_frequencies(lemma_lists)

    min_doc_freq = max(2, int(len(texts) * 0.4))
    significant_terms = {}
    for term, freqs in term_frequencies.items():
        doc_freq = sum(1 for f in freqs if f > 0)
        if doc_freq >= min_doc_freq:
            significant_terms[term] = freqs

    terms = []
    for term, freqs in significant_terms.items():
        freqs_array = [f for f in freqs if f > 0]
        if not freqs_array:
            continue

        sorted_freqs = sorted(freqs_array)
        p10_idx = max(0, int(len(sorted_freqs) * 0.1))
        p90_idx = min(len(sorted_freqs) - 1, int(len(sorted_freqs) * 0.9))
        min_occ = sorted_freqs[p10_idx]
        max_occ = sorted_freqs[p90_idx]
        avg_freq = sum(freqs) / len(texts)
        importance = round(avg_freq * 10, 2)

        word_count = len(term.split())
        if word_count == 1:
            term_type = "unigram"
        elif word_count == 2:
            term_type = "bigram"
        elif word_count == 3:
            term_type = "trigram"
        else:
            term_type = "phrase"

        terms.append({
            "term": term,
            "display_term": term,
            "min_occurrences": max(0, min_occ),
            "max_occurrences": max(min_occ, max_occ),
            "importance": importance,
            "term_type": term_type,
        })

    terms.sort(key=lambda t: t["importance"], reverse=True)

    terms_to_avoid = []
    for term, freqs in term_frequencies.items():
        if len(term.split()) == 1:
            doc_freq = sum(1 for f in freqs if f > 0)
            if doc_freq == len(texts):
                avg_freq = sum(freqs) / len(texts)
                if avg_freq > 5:
                    terms_to_avoid.append(term)

    return {
        "terms": terms[:100],
        "terms_to_avoid": terms_to_avoid[:20],
        "per_url_lemmas": lemma_lists,
        "per_url_entities": all_entities_per_url,
        "per_url_topics": all_topics_per_url,
    }
```

**Step 2: Add new endpoint in `main.py`**

Add after the existing `/analyze` endpoint in `services/nlp/main.py`:

```python
@app.post("/analyze-with-lemmas")
def analyze_with_lemmas(req: AnalyzeRequest):
    try:
        log_structured("info", "Analysis with lemmas started",
                      language=req.language,
                      num_texts=len(req.texts))

        track_textrazor_request()

        from textrazor_pipeline import analyze_corpus_with_lemmas
        result = analyze_corpus_with_lemmas(req.texts, req.language)

        log_structured("info", "Analysis with lemmas completed",
                      language=req.language,
                      num_terms=len(result["terms"]))

        return result
    except Exception as e:
        log_structured("error", "Analysis with lemmas failed",
                      language=req.language,
                      error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 3: Commit**

```bash
git add services/nlp/main.py services/nlp/textrazor_pipeline.py
git commit -m "feat: add /analyze-with-lemmas endpoint returning per-URL NLP results"
```

---

### Task 4: Add `aggregateNlpResults` helper to Next.js

**Files:**
- Create: `apps/web/src/lib/nlp-aggregator.ts`
- Test: `apps/web/src/lib/__tests__/nlp-aggregator.test.ts`

**Step 1: Write the failing test**

Create `apps/web/src/lib/__tests__/nlp-aggregator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { aggregateNlpResults } from '../nlp-aggregator'

describe('aggregateNlpResults', () => {
  it('returns empty terms for empty input', () => {
    const result = aggregateNlpResults([])
    expect(result.terms).toEqual([])
    expect(result.terms_to_avoid).toEqual([])
  })

  it('returns empty terms for single document', () => {
    const result = aggregateNlpResults([['energie', 'solaire']])
    expect(result.terms).toEqual([])
  })

  it('extracts significant terms present in 40%+ of docs', () => {
    // 'energie' appears in 3/3 docs, 'solaire' in 2/3, 'nucleaire' in 1/3
    const lemmaLists = [
      ['energie', 'energie', 'solaire', 'nucleaire'],
      ['energie', 'solaire', 'energie'],
      ['energie', 'eolien'],
    ]
    const result = aggregateNlpResults(lemmaLists)

    const termNames = result.terms.map(t => t.term)
    expect(termNames).toContain('energie') // 3/3 docs = 100%
    expect(termNames).toContain('solaire') // 2/3 docs = 66%
    expect(termNames).not.toContain('nucleaire') // 1/3 docs = 33% < 40%
  })

  it('calculates min/max occurrence ranges', () => {
    const lemmaLists = [
      ['energie', 'energie', 'energie'], // 3 occurrences
      ['energie', 'energie'],             // 2 occurrences
      ['energie'],                         // 1 occurrence
    ]
    const result = aggregateNlpResults(lemmaLists)
    const energieTerm = result.terms.find(t => t.term === 'energie')

    expect(energieTerm).toBeDefined()
    expect(energieTerm!.min_occurrences).toBeGreaterThanOrEqual(1)
    expect(energieTerm!.max_occurrences).toBeLessThanOrEqual(3)
  })

  it('identifies bigrams and trigrams', () => {
    const lemmaLists = [
      ['energie', 'renouvelable', 'energie', 'renouvelable'],
      ['energie', 'renouvelable', 'energie', 'renouvelable'],
      ['energie', 'renouvelable'],
    ]
    const result = aggregateNlpResults(lemmaLists)
    const bigramTerm = result.terms.find(t => t.term === 'energie renouvelable')

    expect(bigramTerm).toBeDefined()
    expect(bigramTerm!.term_type).toBe('bigram')
  })

  it('identifies terms to avoid (high-freq unigrams in all docs)', () => {
    const lemmaLists = [
      ['cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'energie'],
      ['cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'energie'],
      ['cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'cookie', 'energie'],
    ]
    const result = aggregateNlpResults(lemmaLists)
    expect(result.terms_to_avoid).toContain('cookie')
  })

  it('caps output at 100 terms and 20 terms_to_avoid', () => {
    // Generate many unique terms across 3 docs
    const makeLemmas = (prefix: string) => {
      const lemmas: string[] = []
      for (let i = 0; i < 150; i++) {
        lemmas.push(`${prefix}${i}`)
      }
      return lemmas
    }
    // All same terms in all docs so they pass 40% threshold
    const sharedLemmas = makeLemmas('term')
    const lemmaLists = [sharedLemmas, sharedLemmas, sharedLemmas]
    const result = aggregateNlpResults(lemmaLists)

    expect(result.terms.length).toBeLessThanOrEqual(100)
    expect(result.terms_to_avoid.length).toBeLessThanOrEqual(20)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx vitest run src/lib/__tests__/nlp-aggregator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `nlp-aggregator.ts`**

Create `apps/web/src/lib/nlp-aggregator.ts`:

```typescript
/**
 * Local NLP aggregation logic — mirrors the Python pipeline's
 * term frequency calculation so we can reconstruct analysis
 * from cached per-URL lemma lists without calling TextRazor.
 */

interface AggregatedTerm {
  term: string
  display_term: string
  min_occurrences: number
  max_occurrences: number
  importance: number
  term_type: 'unigram' | 'bigram' | 'trigram' | 'phrase'
}

function extractNgrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return []
  const ngrams: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '))
  }
  return ngrams
}

function calculateTermFrequencies(
  lemmaLists: string[][]
): Map<string, number[]> {
  const allTerms = new Map<string, number[]>()
  const numDocs = lemmaLists.length

  for (let docIdx = 0; docIdx < numDocs; docIdx++) {
    const docLemmas = lemmaLists[docIdx]
    const docTermCounts = new Map<string, number>()

    // Unigrams
    for (const lemma of docLemmas) {
      docTermCounts.set(lemma, (docTermCounts.get(lemma) || 0) + 1)
    }

    // Bigrams
    for (const bigram of extractNgrams(docLemmas, 2)) {
      docTermCounts.set(bigram, (docTermCounts.get(bigram) || 0) + 1)
    }

    // Trigrams
    for (const trigram of extractNgrams(docLemmas, 3)) {
      docTermCounts.set(trigram, (docTermCounts.get(trigram) || 0) + 1)
    }

    // Initialize new terms with zeros for previous docs
    for (const term of docTermCounts.keys()) {
      if (!allTerms.has(term)) {
        allTerms.set(term, new Array(docIdx).fill(0))
      }
    }

    // Add counts for current doc
    for (const [term, counts] of allTerms) {
      counts.push(docTermCounts.get(term) || 0)
    }
  }

  // Pad short arrays
  for (const [, counts] of allTerms) {
    while (counts.length < numDocs) {
      counts.push(0)
    }
  }

  return allTerms
}

export function aggregateNlpResults(
  lemmaLists: string[][]
): { terms: AggregatedTerm[]; terms_to_avoid: string[] } {
  if (lemmaLists.length < 2) {
    return { terms: [], terms_to_avoid: [] }
  }

  const termFrequencies = calculateTermFrequencies(lemmaLists)
  const numDocs = lemmaLists.length
  const minDocFreq = Math.max(2, Math.floor(numDocs * 0.4))

  // Filter significant terms
  const terms: AggregatedTerm[] = []

  for (const [term, freqs] of termFrequencies) {
    const docFreq = freqs.filter(f => f > 0).length
    if (docFreq < minDocFreq) continue

    const nonZeroFreqs = freqs.filter(f => f > 0).sort((a, b) => a - b)
    if (nonZeroFreqs.length === 0) continue

    const p10Idx = Math.max(0, Math.floor(nonZeroFreqs.length * 0.1))
    const p90Idx = Math.min(
      nonZeroFreqs.length - 1,
      Math.floor(nonZeroFreqs.length * 0.9)
    )

    const minOcc = nonZeroFreqs[p10Idx]
    const maxOcc = nonZeroFreqs[p90Idx]
    const avgFreq = freqs.reduce((a, b) => a + b, 0) / numDocs
    const importance = Math.round(avgFreq * 10 * 100) / 100

    const wordCount = term.split(' ').length
    let termType: AggregatedTerm['term_type']
    if (wordCount === 1) termType = 'unigram'
    else if (wordCount === 2) termType = 'bigram'
    else if (wordCount === 3) termType = 'trigram'
    else termType = 'phrase'

    terms.push({
      term,
      display_term: term,
      min_occurrences: Math.max(0, minOcc),
      max_occurrences: Math.max(minOcc, maxOcc),
      importance,
      term_type: termType,
    })
  }

  // Sort by importance descending
  terms.sort((a, b) => b.importance - a.importance)

  // Terms to avoid
  const termsToAvoid: string[] = []
  for (const [term, freqs] of termFrequencies) {
    if (term.split(' ').length !== 1) continue
    const docFreq = freqs.filter(f => f > 0).length
    if (docFreq === numDocs) {
      const avgFreq = freqs.reduce((a, b) => a + b, 0) / numDocs
      if (avgFreq > 5) {
        termsToAvoid.push(term)
      }
    }
  }

  return {
    terms: terms.slice(0, 100),
    terms_to_avoid: termsToAvoid.slice(0, 20),
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx vitest run src/lib/__tests__/nlp-aggregator.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/nlp-aggregator.ts apps/web/src/lib/__tests__/nlp-aggregator.test.ts
git commit -m "feat: add local NLP aggregation to reconstruct analysis from cached lemmas"
```

---

### Task 5: Integrate NLP cache into `analyze/route.ts`

**Files:**
- Modify: `apps/web/src/app/api/serp/analyze/route.ts` (lines 224-248)

**Step 1: Add imports**

Add at top of file after existing imports:

```typescript
import { getNlpCacheEntries, setNlpCacheEntries } from '@/lib/nlp-cache'
import { aggregateNlpResults } from '@/lib/nlp-aggregator'
```

**Step 2: Replace the NLP call section (lines 224-248)**

Replace from `// 6. Send texts to NLP service` through the end of the nlpData logging block with:

```typescript
    // 6. Check NLP cache for per-URL results
    const crawledUrls = crawledPages.map(p => p.url)
    const { cached: nlpCached, uncachedUrls } = await getNlpCacheEntries(crawledUrls, lang)

    logger.info('NLP cache check', {
      total: crawledPages.length,
      cached: nlpCached.size,
      uncached: uncachedUrls.length,
    })

    let nlpData: { terms: any[]; terms_to_avoid: string[] }

    if (uncachedUrls.length === 0) {
      // All URLs cached — reconstruct from cached lemma lists (no NLP call!)
      const lemmaLists = crawledPages.map(p => {
        const entry = nlpCached.get(p.url)
        return entry ? (entry.lemmas as string[]) : []
      })
      nlpData = aggregateNlpResults(lemmaLists)

      logger.info('NLP analysis from cache (0 TextRazor calls)', {
        termsFound: nlpData.terms.length,
        termsToAvoid: nlpData.terms_to_avoid.length,
      })
    } else {
      // Some or all URLs uncached — call NLP service with per-URL lemma return
      const uncachedPages = crawledPages.filter(p => uncachedUrls.includes(p.url))

      const nlpStartTime = Date.now()
      const nlpResponse = await fetch(`${process.env.NLP_SERVICE_URL}/analyze-with-lemmas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: uncachedPages.map(p => p.text),
          language: lang,
        }),
      })

      if (!nlpResponse.ok) {
        throw new Error(`NLP service returned ${nlpResponse.status}`)
      }

      const freshData = await nlpResponse.json()

      logger.info('NLP service response', {
        duration: Date.now() - nlpStartTime,
        textrazorCalls: uncachedPages.length,
        savedCalls: nlpCached.size,
      })

      // Cache fresh per-URL results
      if (freshData.per_url_lemmas) {
        const cacheEntries = uncachedPages.map((page, i) => ({
          url: page.url,
          language: lang,
          lemmas: freshData.per_url_lemmas[i] || [],
          entities: freshData.per_url_entities?.[i] || [],
          topics: freshData.per_url_topics?.[i] || [],
        }))
        await setNlpCacheEntries(cacheEntries)
      }

      if (nlpCached.size === 0) {
        // None cached — use fresh NLP response directly
        nlpData = { terms: freshData.terms, terms_to_avoid: freshData.terms_to_avoid }
      } else {
        // Partial cache — merge cached + fresh lemmas, re-aggregate
        const allLemmas = crawledPages.map(p => {
          const cachedEntry = nlpCached.get(p.url)
          if (cachedEntry) return cachedEntry.lemmas as string[]
          const freshIdx = uncachedPages.findIndex(up => up.url === p.url)
          return freshData.per_url_lemmas?.[freshIdx] || []
        })
        nlpData = aggregateNlpResults(allLemmas)
      }

      logger.info('NLP analysis completed', {
        termsFound: nlpData.terms.length,
        termsToAvoid: nlpData.terms_to_avoid.length,
      })
    }
```

**Step 3: Verify TypeScript compiles**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx tsc --noEmit`
Expected: No errors

**Step 4: Run existing SERP analyze tests**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx vitest run src/app/api/serp/analyze/__tests__/route.test.ts`
Expected: PASS (existing tests should still work)

**Step 5: Commit**

```bash
git add apps/web/src/app/api/serp/analyze/route.ts
git commit -m "feat: integrate NLP cache into analyze route — skip TextRazor for cached URLs"
```

---

### Task 6: Integrate NLP cache into `process-job/route.ts`

**Files:**
- Modify: `apps/web/src/app/api/serp/process-job/route.ts` (lines 85-114)

**Step 1: Add imports**

Add after existing imports:
```typescript
import { getNlpCacheEntries, setNlpCacheEntries } from '@/lib/nlp-cache'
import { aggregateNlpResults } from '@/lib/nlp-aggregator'
```

**Step 2: Replace the NLP call section (lines 85-114)**

Replace from `// Step 3: NLP analysis` through the nlpData logging with the same pattern as Task 5:

```typescript
      // Step 3: NLP analysis (with cache)
      await supabase
        .from('serp_jobs')
        .update({ progress_step: 'nlp' })
        .eq('id', jobId)

      const crawledUrls = crawledPages.map(p => p.url)
      const { cached: nlpCached, uncachedUrls } = await getNlpCacheEntries(crawledUrls, lang)

      logger.info('NLP cache check', {
        total: crawledPages.length,
        cached: nlpCached.size,
        uncached: uncachedUrls.length,
      })

      let nlpData: { terms: any[]; terms_to_avoid: string[] }

      if (uncachedUrls.length === 0) {
        const lemmaLists = crawledPages.map(p => {
          const entry = nlpCached.get(p.url)
          return entry ? (entry.lemmas as string[]) : []
        })
        nlpData = aggregateNlpResults(lemmaLists)

        logger.info('NLP analysis from cache (0 TextRazor calls)', {
          termsFound: nlpData.terms.length,
        })
      } else {
        const uncachedPages = crawledPages.filter(p => uncachedUrls.includes(p.url))

        const nlpStartTime = Date.now()
        const nlpResponse = await fetch(`${process.env.NLP_SERVICE_URL}/analyze-with-lemmas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: uncachedPages.map(p => p.text),
            language: lang,
          }),
        })

        if (!nlpResponse.ok) {
          throw new Error(`NLP service returned ${nlpResponse.status}`)
        }

        const freshData = await nlpResponse.json()

        logger.info('NLP analysis completed', {
          duration: Date.now() - nlpStartTime,
          textrazorCalls: uncachedPages.length,
          savedCalls: nlpCached.size,
        })

        // Cache fresh per-URL results
        if (freshData.per_url_lemmas) {
          const cacheEntries = uncachedPages.map((page, i) => ({
            url: page.url,
            language: lang,
            lemmas: freshData.per_url_lemmas[i] || [],
            entities: freshData.per_url_entities?.[i] || [],
            topics: freshData.per_url_topics?.[i] || [],
          }))
          await setNlpCacheEntries(cacheEntries)
        }

        if (nlpCached.size === 0) {
          nlpData = { terms: freshData.terms, terms_to_avoid: freshData.terms_to_avoid }
        } else {
          const allLemmas = crawledPages.map(p => {
            const cachedEntry = nlpCached.get(p.url)
            if (cachedEntry) return cachedEntry.lemmas as string[]
            const freshIdx = uncachedPages.findIndex(up => up.url === p.url)
            return freshData.per_url_lemmas?.[freshIdx] || []
          })
          nlpData = aggregateNlpResults(allLemmas)
        }
      }
```

**Step 3: Verify TypeScript compiles**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/app/api/serp/process-job/route.ts
git commit -m "feat: integrate NLP cache into process-job route"
```

---

### Task 7: Add cache cleanup API endpoint

**Files:**
- Create: `apps/web/src/app/api/nlp-cache/cleanup/route.ts`

**Step 1: Create the cleanup endpoint**

```typescript
import { NextResponse } from 'next/server'
import { cleanExpiredNlpCache } from '@/lib/nlp-cache'
import { logger } from '@/lib/logger'

/**
 * DELETE /api/nlp-cache/cleanup
 * Purges NLP cache entries older than 7 days.
 * Call periodically (e.g., daily cron) or manually.
 */
export async function DELETE() {
  try {
    const deleted = await cleanExpiredNlpCache()
    logger.info('NLP cache cleanup completed', { deleted })
    return NextResponse.json({ deleted })
  } catch (error) {
    logger.error('NLP cache cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/api/nlp-cache/cleanup/route.ts
git commit -m "feat: add NLP cache cleanup endpoint for expired entries"
```

---

### Task 8: Run full test suite and verify TypeScript compilation

**Step 1: TypeScript check**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx tsc --noEmit`
Expected: No errors

**Step 2: Run all tests**

Run: `cd "/Users/neaskol/Downloads/AGENTIC WORKFLOW/serpmantic/apps/web" && npx vitest run`
Expected: All tests pass

**Step 3: If any failures, fix and recommit**

**Step 4: Final commit (if fixes needed)**

```bash
git commit -m "fix: resolve test/compilation issues from NLP cache integration"
```
