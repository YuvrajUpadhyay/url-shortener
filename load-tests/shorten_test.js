/**
 * k6 Load Test: URL Shortening Endpoint
 *
 * Tests POST /api/shorten under:
 *   - Stage 1: Ramp to 100 concurrent users over 30s
 *   - Stage 2: Hold at 100 concurrent users for 60s
 *   - Stage 3: Ramp to 500 concurrent users over 30s
 *   - Stage 4: Hold at 500 concurrent users for 60s
 *   - Stage 5: Ramp down over 30s
 *
 * Run: k6 run load-tests/shorten_test.js
 * With summary export: k6 run --out json=results/shorten_results.json load-tests/shorten_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const shortenTrend = new Trend('shorten_response_time', true);
const successCounter = new Counter('successful_shortens');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp to 100 users
    { duration: '60s', target: 100 },   // Hold at 100 users
    { duration: '30s', target: 500 },   // Ramp to 500 users
    { duration: '60s', target: 500 },   // Hold at 500 users
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],      // 95% of requests under 2s
    http_req_duration: ['p(99)<5000'],      // 99% of requests under 5s
    error_rate: ['rate<0.05'],              // Error rate below 5%
    shorten_response_time: ['p(90)<1000'],  // 90% under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Pool of test URLs to shorten (randomized to avoid dedup returning same result)
const TEST_URLS = [
  'https://www.example.com/very/long/path/to/some/resource?query=value&another=param',
  'https://github.com/features/actions/workflows/ci-cd-pipeline-tutorial',
  'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise',
  'https://docs.mongodb.com/manual/reference/operator/aggregation/group/',
  'https://redis.io/docs/data-types/sorted-sets/',
  'https://www.npmjs.com/package/nanoid?activeTab=readme',
  'https://expressjs.com/en/guide/routing.html#route-parameters',
  'https://mongoosejs.com/docs/schematypes.html#schematype-options',
];

export default function () {
  const randomUrl = TEST_URLS[Math.floor(Math.random() * TEST_URLS.length)];

  // Append a random suffix to defeat server-side dedup and test true write path
  const uniqueUrl = `${randomUrl}&_t=${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const payload = JSON.stringify({ originalUrl: uniqueUrl });

  const response = http.post(`${BASE_URL}/api/shorten`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s',
  });

  const isSuccess = check(response, {
    'status is 201': (r) => r.status === 201,
    'response has shortUrl': (r) => {
      try {
        return JSON.parse(r.body).shortUrl !== undefined;
      } catch {
        return false;
      }
    },
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!isSuccess);
  shortenTrend.add(response.timings.duration);

  if (isSuccess) {
    successCounter.add(1);
  }

  sleep(Math.random() * 0.5 + 0.1); // 100–600ms think time between requests
}

export function handleSummary(data) {
  const summary = {
    test: 'URL Shortening',
    timestamp: new Date().toISOString(),
    stages: '100 → 500 concurrent users',
    metrics: {
      total_requests: data.metrics.http_reqs?.values?.count,
      rps: data.metrics.http_reqs?.values?.rate?.toFixed(2),
      avg_response_ms: data.metrics.http_req_duration?.values?.avg?.toFixed(2),
      p90_response_ms: data.metrics.http_req_duration?.values?.['p(90)']?.toFixed(2),
      p95_response_ms: data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2),
      p99_response_ms: data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2),
      error_rate_pct: (data.metrics.error_rate?.values?.rate * 100)?.toFixed(2),
      successful_shortens: data.metrics.successful_shortens?.values?.count,
    },
  };

  console.log('\n========== SHORTEN ENDPOINT RESULTS ==========');
  console.log(JSON.stringify(summary, null, 2));

  return {
    'results/shorten_summary.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
