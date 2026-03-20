# SERP NLP Cache — Design Document

**Date:** 2026-03-21
**Goal:** Reduce TextRazor API calls by 70-80% via per-URL NLP result caching in Supabase

## Problem

Every SERP analysis sends all crawled page texts (6-10) to TextRazor. When different keywords share common URLs, or when a user re-analyzes a guide, the same pages get re-processed needlessly.

## Architecture

```
L1 — Redis (24h TTL) — full analysis cache by keyword+lang
     │ MISS
L2 — Supabase `nlp_cache` (7d TTL) — per-URL NLP results
     │ MISS
L3 — TextRazor API call (only for uncached URLs)
```

## Implementation

### 1. New Supabase table: `nlp_cache`

Migration `008_create_nlp_cache.sql`:

```sql
CREATE TABLE nlp_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash TEXT NOT NULL,
  url TEXT NOT NULL,
  language TEXT NOT NULL,
  lemmas JSONB NOT NULL,
  entities JSONB DEFAULT '[]',
  topics JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(url_hash, language)
);

CREATE INDEX idx_nlp_cache_lookup ON nlp_cache(url_hash, language);
CREATE INDEX idx_nlp_cache_expiry ON nlp_cache(analyzed_at);
```

### 2. New module: `apps/web/src/lib/nlp-cache.ts`

Functions:
- `getNlpCacheEntries(urls: string[], language: string)` → split into cached/uncached
- `setNlpCacheEntries(entries[])` → upsert results
- `cleanExpiredNlpCache(maxAgeDays = 7)` → purge old entries

URL hashing: SHA-256 of normalized URL (lowercase, trimmed).

### 3. Modified flow in `analyze/route.ts`

Current (lines 224-248): sends ALL texts to NLP service.

New flow:
1. After crawl → hash each URL
2. Query `nlp_cache` for all URL hashes + language
3. Split into cached (< 7 days) vs uncached
4. Only send uncached texts to NLP service
5. Store new NLP results in `nlp_cache`
6. Merge cached + fresh results
7. Continue pipeline (term frequencies, percentiles, scoring)

### 4. NLP service contract unchanged

The Python NLP service `/analyze` endpoint stays the same — it just receives fewer texts when cache hits occur. No changes to `services/nlp/`.

### 5. Observability

- Log: `NLP cache: {hits}/{total} URLs cached, {saved} TextRazor calls saved`
- Headers: `X-NLP-Cache-Hits`, `X-NLP-Cache-Total`

### 6. Cache cleanup

Endpoint `DELETE /api/nlp-cache/cleanup` or periodic SQL:
```sql
DELETE FROM nlp_cache WHERE analyzed_at < NOW() - INTERVAL '7 days';
```

## Estimated Savings

| Scenario | Before | After | Saving |
|----------|--------|-------|--------|
| Same keyword, 2nd user | 10 calls | 0 (Redis L1) | 100% |
| Re-analyze same guide | 10 calls | 0 (Redis L1) | 100% |
| New keyword, 7/10 common URLs | 10 calls | 3 calls | 70% |
| Force refresh, unchanged URLs | 10 calls | 0 (Supabase L2) | 100% |

## Key Decision

Cache stores per-URL NLP results (lemmas, entities, topics), NOT aggregated terms. Aggregation (term frequencies, percentiles, importance) is always recalculated because it depends on the full corpus composition.
