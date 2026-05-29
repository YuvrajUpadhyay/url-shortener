const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');
const { getChannel } = require('../config/rabbitmq');

/**
 * Deep health check endpoint.
 * Returns HTTP 200 if all dependencies are reachable, 503 otherwise.
 * Used by Docker HEALTHCHECK, load balancers, and uptime monitors.
 */
const healthCheck = async (req, res) => {
  const checks = {};
  let allHealthy = true;

  // MongoDB
  const mongoState = mongoose.connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  checks.mongodb = mongoState === 1 ? 'ok' : `degraded (state: ${mongoState})`;
  if (mongoState !== 1) allHealthy = false;

  // Redis
  try {
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = 'ok';
  } catch (err) {
    checks.redis = `degraded (${err.message})`;
    allHealthy = false;
  }

  // RabbitMQ
  try {
    const channel = getChannel();
    checks.rabbitmq = channel ? 'ok' : 'degraded (no channel)';
    if (!channel) allHealthy = false;
  } catch (err) {
    checks.rabbitmq = `degraded (${err.message})`;
    allHealthy = false;
  }

  const statusCode = allHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: allHealthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dependencies: checks,
  });
};

module.exports = { healthCheck };
