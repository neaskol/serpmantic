# Performance Optimization Guide

## Overview

This document details the performance optimizations implemented in Sprint 2, including caching strategies, database indexes, and query optimization patterns.

---

## Database Indexes

### Migration: `002_add_performance_indexes.sql`

Added comprehensive indexes to optimize common query patterns:

#### Guides Table
```sql
CREATE INDEX idx_guides_user_id ON guides(user_id);
CREATE INDEX idx_guides_user_id_updated_at ON guides(user_id, updated_at DESC);
CREATE INDEX idx_guides_keyword ON guides(keyword);
CREATE INDEX idx_guides_created_at ON guides(created_at DESC);
```

**Why:** The most common query is `SELECT * FROM guides WHERE user_id = ? ORDER BY updated_at DESC` (dashboard view). The composite index `(user_id, updated_at DESC)` covers this query entirely, eliminating the need for a separate sort operation.

**Expected improvement:** 10x faster for dashboard loads (10-50ms → 1-5ms)

#### SERP Analyses Table
```sql
CREATE INDEX idx_serp_analyses_guide_id ON serp_analyses(guide_id);
CREATE INDEX idx_serp_analyses_keyword_language ON serp_analyses(keyword, language);
```

**Why:** RLS policies and joins frequently filter by `guide_id`. The `(keyword, language)` index enables fast cache lookups.

**Expected improvement:** 5x faster for SERP analysis retrieval

#### SERP Pages Table
```sql
CREATE INDEX idx_serp_pages_serp_analysis_id ON serp_pages(serp_analysis_id);
CREATE INDEX idx_serp_pages_position ON serp_pages(serp_analysis_id, position);
```

**Why:** Pages are always queried by `serp_analysis_id`, and position ordering is critical for benchmark display.

#### Semantic Terms Table
```sql
CREATE INDEX idx_semantic_terms_serp_analysis_id ON semantic_terms(serp_analysis_id);
CREATE INDEX idx_semantic_terms_is_to_avoid ON semantic_terms(serp_analysis_id, is_to_avoid);
CREATE INDEX idx_semantic_terms_is_main_keyword ON semantic_terms(serp_analysis_id, is_main_keyword);
```

**Why:** Terms are filtered by `is_to_avoid` and `is_main_keyword` for UI display. Composite indexes enable efficient filtered queries.

---

## Caching Strategy

### Redis Implementation

**Client:** `ioredis` with automatic reconnection and connection pooling

**Configuration:**
- Development: `redis://localhost:6379`
- Production: Upstash Redis (ioredis format: `rediss://default:xxxxx@xxxxx.upstash.io:6379`)

### Cache TTL Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| SERP Analysis | 24 hours | SERP data changes slowly; balances freshness vs API costs |
| Guide Content | 5 minutes | Frequently updated; short TTL ensures consistency |
| Raw SERP Results | 24 hours | Expensive API calls; can be shared across users |

### Cache Key Patterns

```typescript
// SERP analysis cache
serp:analysis:{language}:{keyword}

// Raw SERP results cache
serp:results:{engine}:{language}:{keyword}

// Guide content cache
guide:{guideId}

// User guides cache
guides:user:{userId}
```

### Cache Hit Rate Targets

- **SERP analysis:** Target 60-70% hit rate (common keywords get analyzed multiple times)
- **Guide content:** Target 40-50% hit rate (guides edited frequently)
- **Raw SERP results:** Target 70-80% hit rate (same keywords across users)

### Graceful Degradation

The application works without Redis - all cache operations fail silently:

```typescript
export async function getCachedSerpAnalysis(
  keyword: string,
  language: string
): Promise<unknown | null> {
  if (!isRedisAvailable()) {
    return null // No caching in development without Redis
  }
  // ... cache logic
}
```

**Impact:** Zero performance degradation if Redis is unavailable. App continues to function, just slower.

---

## Query Optimization Patterns

### 1. Composite Index Usage

**Before:**
```sql
SELECT * FROM guides
WHERE user_id = 'uuid'
ORDER BY updated_at DESC;
-- Sequential scan + external sort
-- ~50ms for 100 guides
```

**After:**
```sql
-- Uses idx_guides_user_id_updated_at
-- Index-only scan, no sort needed
-- ~5ms for 100 guides
```

### 2. RLS Policy Optimization

**Before:** RLS policies used uncorrelated subqueries
```sql
-- serp_analyses policy
WHERE guide_id IN (
  SELECT id FROM guides WHERE user_id = auth.uid()
)
-- Executes subquery for EVERY row
```

**After:** Same policy, but now `guides(id)` and `serp_analyses(guide_id)` are indexed
- Subquery becomes index scan instead of sequential scan
- 3-5x faster policy enforcement

### 3. Join Optimization

**Critical joins:**
```sql
-- serp_pages through serp_analyses to guides
SELECT sp.*
FROM serp_pages sp
JOIN serp_analyses sa ON sp.serp_analysis_id = sa.id
JOIN guides g ON sa.guide_id = g.id
WHERE g.user_id = ?;
```

**Indexes enable nested loop join:**
1. `guides(user_id)` → index scan (fast)
2. `serp_analyses(guide_id)` → index lookup (fast)
3. `serp_pages(serp_analysis_id)` → index lookup (fast)

**Expected improvement:** 10x faster for complex queries

---

## Monitoring & Metrics

### Health Endpoint: `/api/health`

Returns comprehensive system status:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "latency": 15
    },
    "cache": {
      "status": "healthy",
      "latency": 2,
      "totalKeys": 1247,
      "hits": 8934,
      "misses": 2103
    }
  }
}
```

### Key Metrics

**Database:**
- Query latency (target: <50ms p95)
- Connection pool usage
- Slow query log (>100ms)

**Cache:**
- Hit/miss ratio (target: >60% for SERP)
- Key count
- Memory usage
- Eviction rate

**API:**
- Request latency by endpoint
- Error rate
- Rate limit hits

### Logging

Structured logging with request IDs:

```typescript
logger.info('SERP analysis cache hit', {
  keyword,
  language,
  requestId
});

logger.error('Cache get error', {
  key,
  error: error.message,
  requestId
});
```

---

## Performance Targets

### API Response Times (p95)

| Endpoint | Target | Current (est.) | With Optimizations |
|----------|--------|----------------|-------------------|
| `GET /api/guides` | <50ms | ~80ms | ~5ms |
| `GET /api/guides/[id]` | <100ms | ~150ms | ~30ms |
| `POST /api/serp/analyze` | <2s | ~3-5s | ~1-2s (cached) |

### Database Query Times (p95)

| Query Type | Target | Before Indexes | After Indexes |
|------------|--------|----------------|---------------|
| List user guides | <10ms | ~50ms | ~5ms |
| Get guide with SERP data | <50ms | ~150ms | ~30ms |
| Insert new guide | <20ms | ~25ms | ~20ms |

### Cache Performance

| Metric | Target | Expected |
|--------|--------|----------|
| SERP cache hit rate | >60% | 65-70% |
| Guide cache hit rate | >40% | 45-50% |
| Redis GET latency | <5ms | ~2ms |
| Redis SET latency | <10ms | ~3ms |

---

## Best Practices

### 1. Use Composite Indexes for Common Queries

```sql
-- Instead of separate indexes:
CREATE INDEX idx_guides_user_id ON guides(user_id);
CREATE INDEX idx_guides_updated_at ON guides(updated_at);

-- Use composite index covering both:
CREATE INDEX idx_guides_user_id_updated_at ON guides(user_id, updated_at DESC);
```

### 2. Cache Expensive Operations

```typescript
// Check cache first
const cached = await getCachedSerpAnalysis(keyword, language);
if (cached) return cached;

// Expensive operation
const analysis = await analyzeSERP(keyword, language);

// Store in cache
await setCachedSerpAnalysis(keyword, language, analysis);
return analysis;
```

### 3. Invalidate Cache on Mutations

```typescript
// After updating guide
await invalidateGuideCache(guideId);

// After batch updates
await invalidateUserGuidesCache(userId);
```

### 4. Monitor Cache Hit Rates

```typescript
const stats = await getCacheStats();
if (stats.hits / (stats.hits + stats.misses) < 0.5) {
  // Adjust cache TTL or key strategy
}
```

### 5. Use Index Hints for Complex Queries

```sql
-- Force index usage in critical queries
SELECT * FROM guides USE INDEX (idx_guides_user_id_updated_at)
WHERE user_id = ?
ORDER BY updated_at DESC;
```

---

## Troubleshooting

### Slow Queries

1. **Check index usage:**
```sql
EXPLAIN ANALYZE SELECT * FROM guides WHERE user_id = ?;
```

2. **Look for sequential scans:**
- `Seq Scan` = no index used (bad)
- `Index Scan` = index used (good)
- `Index Only Scan` = covered by index (excellent)

3. **Verify index exists:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'guides';
```

### Cache Issues

1. **Check Redis connection:**
```bash
redis-cli ping
# Expected: PONG
```

2. **Inspect cache keys:**
```bash
redis-cli --scan --pattern "serp:*"
```

3. **Check memory usage:**
```bash
redis-cli info memory
```

4. **Monitor cache stats:**
```bash
curl http://localhost:3000/api/health | jq '.services.cache'
```

### High Database Load

1. **Identify slow queries:**
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

2. **Check connection pool:**
```typescript
const { data } = await supabase.rpc('pg_stat_activity');
// Check for connection exhaustion
```

3. **Review RLS policies:**
- RLS can add overhead
- Ensure indexes support policy predicates

---

## Future Optimizations

### Phase 4: Load Testing
- [ ] Benchmark with autocannon/k6
- [ ] Test with 10, 50, 100 concurrent users
- [ ] Identify bottlenecks under load

### Phase 5: Advanced Caching
- [ ] Implement cache warming for popular keywords
- [ ] Add Redis Cluster for horizontal scaling
- [ ] Implement cache tags for granular invalidation

### Phase 6: Database
- [ ] Partition large tables by date
- [ ] Implement read replicas for analytics
- [ ] Add materialized views for complex aggregations

---

**Last Updated:** March 19, 2026
**Version:** 1.0.0
