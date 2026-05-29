require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const { connectRedis, getRedisClient } = require('./config/redis');
const { connectRabbitMQ, getChannel } = require('./config/rabbitmq');
const { waitFor } = require('./utils/waitFor');

const PORT = parseInt(process.env.PORT, 10) || 5000;

const bootstrap = async () => {
  // Wait for each dependency to be reachable before attempting connection.
  // Especially important in Docker where services start concurrently.
  await waitFor('MongoDB', () => connectDB());
  await waitFor('Redis', () => connectRedis());
  await waitFor('RabbitMQ', () => connectRabbitMQ());

  const server = app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  // Track open connections so shutdown can drain them
  const connections = new Set();
  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => connections.delete(conn));
  });

  const shutdown = async (signal) => {
    console.log(`[Server] ${signal} received, shutting down gracefully`);

    // Stop accepting new connections
    server.close(async () => {
      console.log('[Server] HTTP server closed');

      // Drain infrastructure connections
      try {
        await mongoose.connection.close();
        console.log('[Server] MongoDB disconnected');
      } catch (err) {
        console.error('[Server] Error closing MongoDB:', err.message);
      }

      try {
        const redis = getRedisClient();
        await redis.quit();
        console.log('[Server] Redis disconnected');
      } catch (err) {
        console.error('[Server] Error closing Redis:', err.message);
      }

      try {
        const channel = getChannel();
        await channel.close();
        console.log('[Server] RabbitMQ channel closed');
      } catch (err) {
        console.error('[Server] Error closing RabbitMQ:', err.message);
      }

      process.exit(0);
    });

    // Force-close lingering keep-alive connections after 10s
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      connections.forEach((conn) => conn.destroy());
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled rejections — log and exit so a process manager can restart
  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
    shutdown('unhandledRejection');
  });
};

bootstrap().catch((err) => {
  console.error('[Server] Startup failed:', err);
  process.exit(1);
});
