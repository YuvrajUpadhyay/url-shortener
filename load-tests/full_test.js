/**
 * k6 Load Test: Full Flow
 *
 * Simulates realistic user behavior:
 *   - 70% of VUs hit the redirect endpoint (most common operation)
 *   - 20% of VUs shorten a new URL
 *   - 10% of VUs check analytics
 *
 * This weighted mix matches production traffic patterns.
 *
 * Run: k6 run load-tests/full_test.js
 *
 * Compare Redis ON vs OFF:
 *   Baseline: comment out setCachedUrl calls in urlService.js, run test, save results
 *   Cached:   run test with Redis active, compare p95/p99 latency and RPS
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const redirectLatency = new Trend('redirect_latency_ms', true);
const shortenLatency = new Trend('shorten_latency_ms', true);
const analyticsLatency = new Trend('analytics_latency_ms', true);
const totalRequests = new Counter('total_requests');

export const options = {
  scenarios: {
    // Scenario A: 100 concurrent users
    load_100: {
      executor: 'constant-vus',
      vus: 100,
      duration: '60s',
      startTime: '0s',
      tags: { scenario: '100_users' },
    },
    // Scenario B: 500 concurrent users (starts after 90s cool-off)
    load_500: {
      executor: 'constant-vus',
      vus: 500,
      duration: '60s',
      startTime: '90s',
      tags: { scenario: '500_users' },
    },
  },
  thresholds: {
    redirect_latency_ms: ['p(95)<300', 'p(99)<800'],
    shorten_latency_ms: ['p(95)<2000'],
    error_rate: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Shared pool of short codes built during setup
export function setup() {
  const codes = [];
  const seedCount = 30;

  for (let i = 0; i < seedCount; i++) {
    const res = http.post(
      `${BASE_URL}/api/shorten`,
      JSON.stringify({
        originalUrl: `https://example.com/resource/${i}?run=${Date.now()}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (res.status === 201) {
      codes.push(JSON.parse(res.body).shortCode);
    }
  }

  console.log(`[Setup] Seeded ${codes.length} short codes for redirect pool`);
  return { codes };
}

// Weighted operation picker
function pickOperation() {
  const roll = Math.random();
  if (roll < 0.70) return 'redirect';
  if (roll < 0.90) return 'shorten';
  return 'analytics';
}

export default function (data) {
  const operation = pickOperation();
  const codes = data.codes;

  totalRequests.add(1);

  if (operation === 'redirect' && codes.length > 0) {
    const code = codes[Math.floor(Math.random() * codes.length)];
    const res = http.get(`${BASE_URL}/${code}`, { redirects: 0, timeout: '5s' });

    const ok = check(res, {
      'redirect: status 301/302': (r) => r.status === 301 || r.status === 302,
      'redirect: has Location': (r) => Boolean(r.headers['Location']),
    });

    errorRate.add(!ok);
    redirectLatency.add(res.timings.duration);

  } else if (operation === 'shorten') {
    const res = http.post(
      `${BASE_URL}/api/shorten`,
      JSON.stringify({
        originalUrl: `https://example.com/test?uid=${__VU}&iter=${__ITER}&ts=${Date.now()}`,
      }),
      { headers: { 'Content-Type': 'application/json' }, timeout: '10s' }
    );

    const ok = check(res, {
      'shorten: status 201': (r) => r.status === 201,
      'shorten: has shortCode': (r) => {
        try { return Boolean(JSON.parse(r.body).shortCode); } catch { return false; }
      },
    });

    errorRate.add(!ok);
    shortenLatency.add(res.timings.duration);

    // Add newly created code to local reference if successful
    if (ok && codes.length < 100) {
      try {
        codes.push(JSON.parse(res.body).shortCode);
      } catch { /* ignore */ }
    }

  } else if (operation === 'analytics' && codes.length > 0) {
    const code = codes[Math.floor(Math.random() * codes.length)];
    const res = http.get(`${BASE_URL}/api/analytics/${code}`, { timeout: '5s' });

    const ok = check(res, {
      'analytics: status 200': (r) => r.status === 200,
      'analytics: has totalClicks': (r) => {
        try { return typeof JSON.parse(r.body).totalClicks === 'number'; } catch { return false; }
      },
    });

    errorRate.add(!ok);
    analyticsLatency.add(res.timings.duration);
  }

  sleep(Math.random() * 0.5 + 0.05);
}

export function handleSummary(data) {
  const fmt = (key, stat) => data.metrics[key]?.values?.[stat]?.toFixed(2) ?? 'N/A';

  const summary = {
    test: 'Full Flow (70% redirect / 20% shorten / 10% analytics)',
    timestamp: new Date().toISOString(),
    total_requests: data.metrics.total_requests?.values?.count,
    overall_rps: data.metrics.http_reqs?.values?.rate?.toFixed(2),
    error_rate_pct: ((data.metrics.error_rate?.values?.rate ?? 0) * 100).toFixed(2),

    redirect: {
      avg_ms: fmt('redirect_latency_ms', 'avg'),
      p50_ms: fmt('redirect_latency_ms', 'p(50)'),
      p90_ms: fmt('redirect_latency_ms', 'p(90)'),
      p95_ms: fmt('redirect_latency_ms', 'p(95)'),
      p99_ms: fmt('redirect_latency_ms', 'p(99)'),
    },

    shorten: {
      avg_ms: fmt('shorten_latency_ms', 'avg'),
      p90_ms: fmt('shorten_latency_ms', 'p(90)'),
      p95_ms: fmt('shorten_latency_ms', 'p(95)'),
      p99_ms: fmt('shorten_latency_ms', 'p(99)'),
    },

    analytics: {
      avg_ms: fmt('analytics_latency_ms', 'avg'),
      p95_ms: fmt('analytics_latency_ms', 'p(95)'),
    },

    interpretation: {
      cached_redirects_expected_p95: '<50ms',
      uncached_redirects_expected_p95: '200-400ms',
      improvement_factor: 'Typically 4-10x latency reduction with Redis',
    },
  };

  console.log('\n========== FULL FLOW TEST RESULTS ==========');
  console.log(JSON.stringify(summary, null, 2));

  return {
    'results/full_summary.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
