#!/usr/bin/env node

/**
 * Load Test: GET /api/guides/[id]
 * Target: <100ms p95
 *
 * This benchmarks fetching a single guide with all SERP analysis data.
 * Uses nested SELECT to fetch guide + analysis + pages + terms in one query.
 */

import autocannon from 'autocannon';

const url = process.env.TEST_URL || 'http://localhost:3000';
const authCookie = process.env.AUTH_COOKIE || '';
const guideId = process.env.GUIDE_ID || '';

if (!authCookie) {
  console.error('ERROR: AUTH_COOKIE environment variable is required');
  console.error('Usage: AUTH_COOKIE=<cookie> GUIDE_ID=<uuid> pnpm load:test:guide-detail');
  process.exit(1);
}

if (!guideId) {
  console.error('ERROR: GUIDE_ID environment variable is required');
  console.error('Usage: AUTH_COOKIE=<cookie> GUIDE_ID=<uuid> pnpm load:test:guide-detail');
  process.exit(1);
}

const instance = autocannon({
  url: `${url}/api/guides/${guideId}`,
  connections: 10,
  duration: 10,
  pipelining: 1,
  headers: {
    'Cookie': authCookie,
  },
}, (err, result) => {
  if (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }

  console.log('\n=== GET /api/guides/[id] Results ===');
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
  const target = 100;
  console.log(`\n✅ Target: p95 < ${target}ms`);
  if (p95 < target) {
    console.log(`✅ PASS: ${p95}ms < ${target}ms`);
  } else {
    console.log(`❌ FAIL: ${p95}ms >= ${target}ms`);
    process.exit(1);
  }
});

autocannon.track(instance, { renderProgressBar: true });
