/**
 * k6 Load Test: Redis Cache Comparison
 *
 * PURPOSE:
 * Isolates the performance impact of Redis caching by testing the same
 * short code repeatedly — first request hits MongoDB, all subsequent hits Redis.
 *
 * HOW TO USE:
 *
 * Step 1 - Baseline (no cache):
 *   1. Flush Redis: redis-cli FLUSHDB
 *   2. In server/services/cacheService.js, make getCachedUrl always return null:
 *        const getCachedUrl = async () => null;
 *   3. Restart server
 *   4. Run: k6 run --env MODE=baseline load-tests/cache_comparison_test.js
 *   5. Save output from results/cache_comparison_summary.json
 *
 * Step 2 - With Redis:
 *   1. Revert getCachedUrl change, restart server
 *   2. Run: k6 run --env MODE=cached load-tests/cache_comparison_test.js
 *   3. Compare results
 *
 * Expected: p95 drops from ~150-400ms (MongoDB) to <30ms (Redis in-memory lookup)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const redirectLatency = new Trend('redirect_ms', true);
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    users_100: {
      executor: 'constant-vus',
      vus: 100,
      duration: '45s',
      startTime: '5s',
    },
    users_500: {
      executor: 'constant-vus',
      vus: 500,
      duration: '45s',
      startTime: '60s',
    },
  },
  thresholds: {
    redirect_ms: ['p(95)<1000'],
    error_rate: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const MODE = __ENV.MODE || 'cached'; // 'baseline' or 'cached'

export function setup() {
  // Create a single short code — all VUs will hammer this same code
  // This guarantees maximum cache hit rate in "cached" mode
  const res = http.post(
    `${BASE_URL}/api/shorten`,
    JSON.stringify({ originalUrl: 'https://example.com/cache-test-target' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status !== 201) {
    throw new Error(`Setup failed: ${res.status} ${res.body}`);
  }

  const { shortCode } = JSON.parse(res.body);
  console.log(`[Setup] Test code: ${shortCode} | Mode: ${MODE}`);
  return { shortCode };
}

export default function (data) {
  const { shortCode } = data;

  const res = http.get(`${BASE_URL}/${shortCode}`, {
    redirects: 0,
    timeout: '5s',
    tags: { mode: MODE },
  });

  const ok = check(res, {
    'status 301 or 302': (r) => r.status === 301 || r.status === 302,
    'has Location header': (r) => Boolean(r.headers['Location']),
  });

  errorRate.add(!ok);
  redirectLatency.add(res.timings.duration);

  sleep(0.01); // Minimal sleep — maximize pressure on server
}

export function handleSummary(data) {
  const fmt = (stat) => data.metrics.redirect_ms?.values?.[stat]?.toFixed(2) ?? 'N/A';

  const summary = {
    mode: MODE,
    timestamp: new Date().toISOString(),
    description: MODE === 'baseline'
      ? 'Every request hits MongoDB (no Redis cache)'
      : 'Requests served from Redis after first cache population',
    metrics: {
      total_requests: data.metrics.http_reqs?.values?.count,
      rps: data.metrics.http_reqs?.values?.rate?.toFixed(2),
      avg_ms: fmt('avg'),
      min_ms: fmt('min'),
      p50_ms: fmt('p(50)'),
      p90_ms: fmt('p(90)'),
      p95_ms: fmt('p(95)'),
      p99_ms: fmt('p(99)'),
      max_ms: fmt('max'),
      error_rate_pct: ((data.metrics.error_rate?.values?.rate ?? 0) * 100).toFixed(2),
    },
    next_steps: MODE === 'baseline'
      ? 'Now enable Redis caching and run with MODE=cached to see improvement'
      : 'Compare these numbers against baseline to quantify Redis impact',
  };

  console.log(`\n========== CACHE COMPARISON: ${MODE.toUpperCase()} ==========`);
  console.log(JSON.stringify(summary, null, 2));

  return {
    [`results/cache_${MODE}_summary.json`]: JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
