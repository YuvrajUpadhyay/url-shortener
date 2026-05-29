/**
 * k6 Load Test: URL Redirect Endpoint
 *
 * This test measures the redirect endpoint performance with Redis caching.
 * To compare WITH vs WITHOUT Redis:
 *   - Run once with Redis active   → captures cached performance
 *   - Flush Redis (redis-cli FLUSHDB), disable cache in cacheService.js, run again → baseline
 *
 * The test pre-seeds short codes by calling /api/shorten in the setup phase,
 * then hammers the redirect endpoint with those codes.
 *
 * Run: k6 run load-tests/redirect_test.js
 * With env var: k6 run -e BASE_URL=http://localhost:5000 load-tests/redirect_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const redirectTrend = new Trend('redirect_response_time', true);
const cacheHitIndicator = new Trend('redirect_2xx_time', true);
const notFoundCounter = new Counter('not_found_count');

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '60s', target: 100 },
    { duration: '30s', target: 500 },
    { duration: '60s', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    redirect_response_time: ['p(95)<300'],    // Cached redirects must be very fast
    redirect_response_time: ['p(99)<1000'],
    error_rate: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// These short codes are seeded in the setup() phase below
let seededCodes = [];

/**
 * setup() runs once before the test starts.
 * It creates a pool of short URLs that the main VUs will then pound.
 */
export function setup() {
  const codes = [];
  const seedCount = 20; // Seed 20 unique short codes

  const testUrls = [
    'https://example.com/page-1',
    'https://example.com/page-2',
    'https://example.com/page-3',
    'https://example.com/page-4',
    'https://example.com/page-5',
    'https://example.com/long-url-for-testing-redirect-performance',
    'https://github.com/test-repo/readme',
    'https://developer.mozilla.org/en-US/docs/Web/API',
    'https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick',
    'https://redis.io/commands/get/',
  ];

  console.log(`[Setup] Seeding ${seedCount} short codes...`);

  for (let i = 0; i < seedCount; i++) {
    const url = testUrls[i % testUrls.length] + `?seed=${i}`;
    const res = http.post(
      `${BASE_URL}/api/shorten`,
      JSON.stringify({ originalUrl: url }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (res.status === 201) {
      const body = JSON.parse(res.body);
      codes.push(body.shortCode);
    } else {
      console.warn(`[Setup] Failed to seed URL #${i}: ${res.status} ${res.body}`);
    }
  }

  console.log(`[Setup] Seeded ${codes.length} short codes: ${codes.join(', ')}`);
  return { codes };
}

export default function (data) {
  const codes = data.codes;
  if (!codes || codes.length === 0) {
    console.error('No seeded codes available — check setup()');
    return;
  }

  // Pick a random seeded code — these will hit Redis cache after first access
  const code = codes[Math.floor(Math.random() * codes.length)];

  // redirects: k6 does NOT follow redirects by default, so we get the 302 directly
  const response = http.get(`${BASE_URL}/${code}`, {
    redirects: 0,  // We measure the redirect response, not the destination
    timeout: '5s',
  });

  const isSuccess = check(response, {
    'status is 302 or 301': (r) => r.status === 301 || r.status === 302,
    'has Location header': (r) => r.headers['Location'] !== undefined,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(!isSuccess);
  redirectTrend.add(response.timings.duration);

  if (response.status === 301 || response.status === 302) {
    cacheHitIndicator.add(response.timings.duration);
  }

  if (response.status === 404) {
    notFoundCounter.add(1);
  }

  sleep(Math.random() * 0.3); // 0–300ms think time — simulate realistic load
}

export function teardown(data) {
  console.log(`[Teardown] Test complete. Codes tested: ${data.codes.join(', ')}`);
}

export function handleSummary(data) {
  const summary = {
    test: 'URL Redirect (with Redis cache)',
    timestamp: new Date().toISOString(),
    stages: '100 → 500 concurrent users',
    note: 'Run redis-cli FLUSHDB then set DISABLE_CACHE=true for baseline comparison',
    metrics: {
      total_requests: data.metrics.http_reqs?.values?.count,
      rps: data.metrics.http_reqs?.values?.rate?.toFixed(2),
      avg_response_ms: data.metrics.redirect_response_time?.values?.avg?.toFixed(2),
      p50_response_ms: data.metrics.redirect_response_time?.values?.['p(50)']?.toFixed(2),
      p90_response_ms: data.metrics.redirect_response_time?.values?.['p(90)']?.toFixed(2),
      p95_response_ms: data.metrics.redirect_response_time?.values?.['p(95)']?.toFixed(2),
      p99_response_ms: data.metrics.redirect_response_time?.values?.['p(99)']?.toFixed(2),
      error_rate_pct: (data.metrics.error_rate?.values?.rate * 100)?.toFixed(2),
      not_found_count: data.metrics.not_found_count?.values?.count,
    },
  };

  console.log('\n========== REDIRECT ENDPOINT RESULTS ==========');
  console.log(JSON.stringify(summary, null, 2));

  return {
    'results/redirect_summary.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
