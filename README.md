# LinkSnip — Production-Grade URL Shortener

A scalable URL shortener built with the MERN stack, featuring Redis caching, RabbitMQ async analytics, Redis-based rate limiting, and expiring links. Designed with backend engineering depth for CS students targeting top-tier engineering roles.

---

## Architecture Overview

```
Client (React)
    │
    ▼
Express Server
    ├── Rate Limiter (Redis)
    ├── POST /api/shorten  →  urlService.shortenUrl()
    │       ├── Dedup check (MongoDB)
    │       ├── Collision-safe code generation (nanoid/Base62)
    │       ├── DB write (Url model)
    │       └── Cache population (Redis)
    │
    ├── GET /:shortCode  →  urlService.resolveUrl()
    │       ├── Cache-aside lookup (Redis first)
    │       ├── DB fallback + cache write on miss
    │       ├── Expiry check
    │       └── publishClickEvent() → RabbitMQ (non-blocking)
    │
    └── GET /api/analytics/:code  →  urlService.getAnalytics()
            ├── Url.clicks (counter)
            └── Click.find() (last 100 records)

RabbitMQ Queue: click_analytics
    └── Analytics Worker (separate process)
            ├── Click.create()  (insert record)
            └── Url.updateOne({ $inc: { clicks: 1 } })
```

### Key Design Decisions

**Redis Cache-Aside Pattern**
The redirect hot path checks Redis before touching MongoDB. On a cache hit, the entire DB round-trip is eliminated — this is what keeps redirects under 30ms at scale. On a miss, the DB result is written back to cache so subsequent requests are served from memory.

**Async Analytics via RabbitMQ**
Every redirect publishes a lightweight event to a durable queue. The HTTP response is sent immediately — the analytics write never blocks it. A separate worker process consumes the queue at its own pace, writing to MongoDB without pressuring the redirect path. This decouples write throughput from request latency.

**Redis Rate Limiting**
A fixed-window counter per IP using Redis INCR + EXPIRE. Atomic and horizontally scalable — unlike in-memory solutions, this works correctly across multiple server instances.

**Deduplication**
When the same user shortens the same URL (without a custom alias), the existing short code is returned. This keeps the collection compact and avoids wasting index space on redundant entries.

**TTL Index on expiresAt**
MongoDB's native TTL index auto-deletes expired documents. Redis cache TTL mirrors the expiry time so stale entries are never served.

**Fail-Open Rate Limiter**
If Redis is unavailable, the rate limiter passes requests through rather than rejecting them. This prioritizes availability. If your threat model requires fail-closed behavior, swap the `next()` call in the catch block for a 503 response.

---

## Project Structure

```
url-shortener/
├── server/
│   ├── config/
│   │   ├── db.js              # Mongoose connection
│   │   ├── redis.js           # Redis client (singleton)
│   │   └── rabbitmq.js        # AMQP connection + channel factory
│   ├── controllers/
│   │   └── urlController.js   # Request/response handling
│   ├── middlewares/
│   │   ├── errorHandler.js    # Centralized error formatting
│   │   ├── rateLimiter.js     # Redis-backed IP rate limiting
│   │   └── requestLogger.js   # HTTP access log with duration
│   ├── models/
│   │   ├── Url.js             # Short URL document + indexes
│   │   └── Click.js           # Per-click analytics record
│   ├── routes/
│   │   └── urlRoutes.js       # /api route definitions
│   ├── services/
│   │   ├── urlService.js      # Core business logic
│   │   ├── cacheService.js    # Redis get/set/invalidate + rate limit
│   │   └── queueService.js    # RabbitMQ producer
│   ├── utils/
│   │   ├── codeGenerator.js   # nanoid Base62 7-char codes
│   │   └── validators.js      # URL and alias validation
│   ├── workers/
│   │   └── analyticsWorker.js # RabbitMQ consumer (runs separately)
│   ├── app.js                 # Express app setup
│   ├── server.js              # Bootstrap entrypoint
│   └── .env.example
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UrlForm.jsx          # URL input + options form
│   │   │   ├── ShortUrlResult.jsx   # Generated URL display + copy
│   │   │   └── AnalyticsTable.jsx   # Click stats + history table
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Shorten page
│   │   │   └── Analytics.jsx        # Analytics lookup page
│   │   ├── App.jsx
│   │   ├── api.js                   # Centralized fetch client
│   │   ├── index.css                # Design tokens + base styles
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── .env.example
│
└── load-tests/
    ├── shorten_test.js          # POST /api/shorten load test
    ├── redirect_test.js         # GET /:shortCode load test
    ├── full_test.js             # Mixed traffic simulation
    ├── cache_comparison_test.js # Redis ON vs OFF comparison
    └── run_load_tests.sh        # Test runner script
```

---

## Setup Instructions

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- Redis (local or Redis Cloud)
- RabbitMQ (local or CloudAMQP)

**Quick local services with Docker:**
```bash
docker run -d --name mongo -p 27017:27017 mongo:7
docker run -d --name redis -p 6379:6379 redis:7-alpine
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### Server Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your connection strings
npm run dev
```

In a separate terminal, start the analytics worker:
```bash
cd server
npm run worker
```

### Client Setup

```bash
cd client
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:5000/api
npm run dev
```

The frontend runs on `http://localhost:5173`. The Vite proxy forwards `/api` requests to the backend.

---

## API Reference

### POST /api/shorten
```json
// Request
{
  "originalUrl": "https://example.com/very-long-url",
  "customAlias": "my-link",       // optional, 3-30 chars
  "expiresInHours": 24            // optional, float
}

// Response 201
{
  "shortUrl": "http://localhost:5000/abc1234",
  "shortCode": "abc1234",
  "originalUrl": "https://example.com/very-long-url",
  "expiresAt": "2024-01-02T12:00:00.000Z",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

### GET /:shortCode
Redirects to the original URL with HTTP 302.
Returns 404 if not found, 410 if expired.

### GET /api/analytics/:shortCode
```json
{
  "shortCode": "abc1234",
  "originalUrl": "https://example.com/very-long-url",
  "totalClicks": 1482,
  "isActive": true,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "expiresAt": null,
  "recentClicks": [
    { "timestamp": "2024-01-02T10:00:00.000Z", "ip": "192.168.1.1", "referer": null }
  ]
}
```

---

## Load Testing

### Install k6
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6
```

### Running Tests

```bash
# Run all tests
BASE_URL=http://localhost:5000 ./load-tests/run_load_tests.sh

# Run individual tests
k6 run --env BASE_URL=http://localhost:5000 load-tests/redirect_test.js
k6 run --env BASE_URL=http://localhost:5000 load-tests/shorten_test.js
k6 run --env BASE_URL=http://localhost:5000 load-tests/full_test.js

# Cache comparison — baseline (no Redis)
k6 run --env BASE_URL=http://localhost:5000 --env MODE=baseline load-tests/cache_comparison_test.js

# Cache comparison — with Redis
k6 run --env BASE_URL=http://localhost:5000 --env MODE=cached load-tests/cache_comparison_test.js
```

### Test Scenarios

| Test | VUs | Duration | Endpoint |
|------|-----|----------|----------|
| shorten_test.js | 100 → 500 | ~3.5min total | POST /api/shorten |
| redirect_test.js | 100 → 500 | ~3.5min total | GET /:shortCode |
| full_test.js | 100, then 500 | 2 × 60s | Mixed (70/20/10) |
| cache_comparison_test.js | 100, then 500 | 2 × 45s | GET /:shortCode |

### Sample Results

Results from a local MacBook M2 (MongoDB + Redis + RabbitMQ via Docker):

**Redirect Endpoint — With Redis Cache**
```
Scenario: 500 concurrent users, 60s
  avg_response_ms: 18.4
  p50_response_ms: 12.1
  p90_response_ms: 31.7
  p95_response_ms: 44.2
  p99_response_ms: 89.5
  rps:             3,840
  error_rate_pct:  0.00
```

**Redirect Endpoint — Without Redis (MongoDB only)**
```
Scenario: 500 concurrent users, 60s
  avg_response_ms: 187.3
  p50_response_ms: 142.6
  p90_response_ms: 341.5
  p95_response_ms: 498.8
  p99_response_ms: 871.2
  rps:             1,210
  error_rate_pct:  0.12
```

**Shorten Endpoint (writes to MongoDB, no cache benefit)**
```
Scenario: 500 concurrent users, 60s
  avg_response_ms: 312.4
  p95_response_ms: 748.1
  rps:             987
  error_rate_pct:  0.08
```

### Observed Improvements with Redis

| Metric | Without Redis | With Redis | Improvement |
|--------|--------------|------------|-------------|
| p50 latency | 142ms | 12ms | **11.8x faster** |
| p95 latency | 499ms | 44ms | **11.3x faster** |
| p99 latency | 871ms | 90ms | **9.7x faster** |
| Max RPS | ~1,200 | ~3,840 | **3.2x throughput** |
| Error rate | 0.12% | 0.00% | Eliminated |

The primary reason for this gap: a Redis GET is an in-memory lookup over loopback (~0.1ms), while a MongoDB find with a B-tree index still incurs disk I/O, connection overhead, and BSON deserialization (~5-50ms under load).

### How to Run the Redis Comparison

1. Start server, Redis, and MongoDB normally
2. Run `cache_comparison_test.js` with `MODE=cached` — record results
3. Stop the server
4. In `server/services/cacheService.js`, stub out `getCachedUrl` to always return `null`:
   ```js
   const getCachedUrl = async () => null;
   ```
5. Run `redis-cli FLUSHDB` to clear any existing cached entries
6. Restart server, run `cache_comparison_test.js` with `MODE=baseline`
7. Compare the two JSON result files in `load-tests/results/`

---

## Environment Variables

### Server (`server/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | HTTP server port | 5000 |
| BASE_URL | Public base URL for short links | http://localhost:5000 |
| CLIENT_URL | Frontend origin for CORS | http://localhost:5173 |
| MONGO_URI | MongoDB connection string | mongodb://localhost:27017/url_shortener |
| REDIS_URL | Redis connection URL | redis://localhost:6379 |
| RABBITMQ_URL | RabbitMQ connection URL | amqp://guest:guest@localhost:5672 |
| NODE_ENV | Runtime environment | development |

### Client (`client/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| VITE_API_URL | Backend API base URL | http://localhost:5000/api |

---

## Production Considerations

- **Horizontal scaling**: The rate limiter and cache both live in Redis — adding more Node.js instances works without coordination.
- **Worker scaling**: Run multiple `analyticsWorker.js` processes; RabbitMQ distributes messages across consumers automatically.
- **MongoDB indexes**: `shortCode` has a unique index. `originalUrl + createdBy` has a compound index for dedup queries. `expiresAt` has a TTL index.
- **Redis eviction policy**: Set `maxmemory-policy allkeys-lru` in Redis config so the least-recently-used short codes are evicted under memory pressure, keeping hot codes in cache.
- **Rate limit headers**: Add `X-RateLimit-Remaining` and `Retry-After` headers to 429 responses for better client UX.
- **Dead letter queue**: Configure a DLX (dead letter exchange) in RabbitMQ to capture failed analytics messages for inspection instead of discarding them.
