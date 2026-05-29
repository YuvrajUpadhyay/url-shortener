const { createClient } = require('redis');

let redisClient = null;

const connectRedis = async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Redis] Max reconnection attempts reached');
          return new Error('Redis max retries exceeded');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on('error', (err) => console.error('[Redis] Client error:', err.message));
  redisClient.on('connect', () => console.log('[Redis] Connected'));
  redisClient.on('reconnecting', () => console.warn('[Redis] Reconnecting...'));

  await redisClient.connect();
  return redisClient;
};

const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client is not initialized or connection is closed');
  }
  return redisClient;
};

module.exports = { connectRedis, getRedisClient };
