# Load Testing

Performance benchmarks for SERPmantics API endpoints using [autocannon](https://github.com/mcollina/autocannon).

## Prerequisites

1. **Running server:** Start the development server
```bash
pnpm dev
```

2. **Authentication:** Obtain a session cookie
- Login at http://localhost:3000/login
- Open browser DevTools → Network tab
- Copy the `sb-access-token` cookie value

3. **Test data:** Create at least one guide with SERP analysis

## Running Benchmarks

### List Guides (Dashboard)
```bash
AUTH_COOKIE="sb-access-token=..." pnpm load:test:guides
```

**Target:** p95 < 50ms

### Guide Detail
```bash
AUTH_COOKIE="sb-access-token=..." GUIDE_ID="uuid" pnpm load:test:guide-detail
```

**Target:** p95 < 100ms

## Interpreting Results

### Latency Percentiles
- **P50 (median):** Half of requests faster than this
- **P95:** 95% of requests faster than this (SLA target)
- **P99:** 99% of requests faster than this
- **Max:** Slowest request

### Throughput
- **req/s:** Requests per second the server can handle

### Example Output
```
=== GET /api/guides Results ===
Requests: 1500
Duration: 10s
Throughput: 150 req/s

Latency:
  Mean: 25ms
  P50:  20ms
  P75:  30ms
  P90:  40ms
  P95:  45ms ✅
  P99:  60ms
  Max:  85ms

✅ Target: p95 < 50ms
✅ PASS: 45ms < 50ms
```

## Performance Targets

| Endpoint | p95 Target | Expected (with optimizations) |
|----------|------------|------------------------------|
| `GET /api/guides` | <50ms | ~5ms (composite index) |
| `GET /api/guides/[id]` | <100ms | ~30ms (nested SELECT) |
| `POST /api/serp/analyze` | <2s | ~1-2s (cached) |

## Load Testing Scenarios

### Light Load (10 concurrent users)
```bash
# Default configuration
pnpm load:test:guides
```

### Medium Load (50 concurrent users)
```bash
# Edit script: connections: 50
```

### Heavy Load (100 concurrent users)
```bash
# Edit script: connections: 100, duration: 30
```

## Optimization Checklist

If targets are not met:

### 1. Database
- [ ] Verify indexes exist (`002_add_performance_indexes.sql`)
- [ ] Check RLS policy performance
- [ ] Review slow query logs

### 2. Caching
- [ ] Check Redis connection (`/api/health`)
- [ ] Verify cache hit rates (target >60%)
- [ ] Review TTL strategy

### 3. Application
- [ ] Profile with `--inspect` flag
- [ ] Check for N+1 queries
- [ ] Review middleware overhead

### 4. Infrastructure
- [ ] Increase database connection pool
- [ ] Scale Redis instances
- [ ] Enable CDN for static assets

## Troubleshooting

### "Connection refused"
Server not running. Start with `pnpm dev`.

### "Unauthorized" errors
Invalid or expired cookie. Login again and refresh cookie.

### Inconsistent results
- Run multiple times to warm up cache
- Ensure no other load on server
- Check for background processes

### High latency
1. Check `/api/health` for database/cache status
2. Review database slow query log
3. Profile application with `node --inspect`

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Performance Benchmarks
  run: |
    pnpm dev &
    sleep 10
    AUTH_COOKIE=${{ secrets.TEST_COOKIE }} pnpm load:test:guides
    AUTH_COOKIE=${{ secrets.TEST_COOKIE }} GUIDE_ID=${{ secrets.TEST_GUIDE_ID }} pnpm load:test:guide-detail
```

## References

- [autocannon documentation](https://github.com/mcollina/autocannon)
- [Performance Guide](../docs/performance.md)
- [API Documentation](../docs/api.md)
