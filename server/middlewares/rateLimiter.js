const { checkRateLimit } = require('../services/cacheService');

/**
 * Redis-based rate limiter middleware.
 *
 * Uses a fixed-window counter per IP address. The counter increments on each request
 * and expires after RATE_LIMIT_WINDOW_SECONDS seconds.
 *
 * Fail-open: if Redis is unavailable, requests are allowed through to preserve availability.
 * Adjust to fail-closed if security is more critical than availability in your context.
 */
const rateLimiter = async (req, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const isAllowed = await checkRateLimit(clientIp);

    if (!isAllowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Maximum 100 requests per minute.',
        retryAfter: 60,
      });
    }

    next();
  } catch (err) {
    // Redis failure: log and allow the request through
    console.error('[RateLimiter] Redis unavailable, failing open:', err.message);
    next();
  }
};

module.exports = rateLimiter;
