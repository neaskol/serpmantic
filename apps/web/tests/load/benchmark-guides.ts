#!/usr/bin/env node

/**
 * Load Test: GET /api/guides
 * Target: <50ms p95
 *
 * This benchmarks the main dashboard query that lists all guides for a user.
 * With the composite index on (user_id, updated_at), we expect ~5ms latency.
 */

import autocannon from 'autocannon';

const url = process.env.TEST_URL || 'http://localhost:3000';
const authCookie = process.env.AUTH_COOKIE || '';

if (!authCookie) {
  console.error('ERROR: AUTH_COOKIE environment variable is required');
  console.error('Usage: AUTH_COOKIE=<cookie> pnpm load:test:guides');
  process.exit(1);
}

const instance = autocannon({
  url: `${url}/api/guides`,
  connections: 10, // Concurrent connections
  duration: 10, // Test duration in seconds
  pipelining: 1,
  headers: {
    'Cookie': authCookie,
  },
}, (err, result) => {
  if (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }

  console.log('\n=== GET /api/guides Results ===');
  console.log(`Requests: ${result.requests.total}`);
  console.log(`Duration: ${result.duration}s`);
  console.log(`Throughput: ${result.throughput.average} req/s`);
  console.log('\nLatency:');
  console.log(`  Mean: ${result.latency.mean}ms`);
  console.log(`  P50:  ${result.latency.p50}ms`);
  console.log(`  P75:  ${result.latency.p75}ms`);
  console.log(`  P90:  ${result.latency.p90}ms`);
  console.log(`  P95:  ${result.latency.p95}ms`);
  console.log(`  P99:  ${result.latency.p99}ms`);
  console.log(`  Max:  ${result.latency.max}ms`);

  // Check SLA
  const p95 = result.latency.p95;
  const target = 50;
  console.log(`\n✅ Target: p95 < ${target}ms`);
  if (p95 < target) {
    console.log(`✅ PASS: ${p95}ms < ${target}ms`);
  } else {
    console.log(`❌ FAIL: ${p95}ms >= ${target}ms`);
    process.exit(1);
  }
});

autocannon.track(instance, { renderProgressBar: true });
