const { getRedisClient } = require('../config/redis');

const DEFAULT_URL_TTL = 3600; // 1 hour
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Retrieves the cached originalUrl for a given shortCode.
 * Returns null on cache miss.
 */
const getCachedUrl = async (shortCode) => {
  const client = getRedisClient();
  return client.get(`url:${shortCode}`);
};

/**
 * Caches the shortCode → originalUrl mapping with a TTL.
 * Uses the link's expiry time if set, otherwise falls back to default TTL.
 */
const setCachedUrl = async (shortCode, originalUrl, ttlSeconds = DEFAULT_URL_TTL) => {
  if (ttlSeconds <= 0) return; // Don't cache already-expired links
  const client = getRedisClient();
  await client.setEx(`url:${shortCode}`, ttlSeconds, originalUrl);
};

/**
 * Removes a cached mapping — used when a link is deleted or deactivated.
 */
const invalidateCache = async (shortCode) => {
  const client = getRedisClient();
  await client.del(`url:${shortCode}`);
};

/**
 * Redis-based sliding-window rate limiter.
 * Returns true if the request is within limits, false if it should be blocked.
 *
 * Uses INCR + EXPIRE: atomic increment, expiry set only on first request in window.
 */
const checkRateLimit = async (ip) => {
  const client = getRedisClient();
  const key = `rate:${ip}`;

  const requestCount = await client.incr(key);
  if (requestCount === 1) {
    // First request in this window — set the expiry
    await client.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }

  return requestCount <= RATE_LIMIT_MAX_REQUESTS;
};

module.exports = {
  getCachedUrl,
  setCachedUrl,
  invalidateCache,
  checkRateLimit,
};
