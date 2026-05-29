require('dotenv').config();
const amqplib = require('amqplib');
const mongoose = require('mongoose');
const Click = require('../models/Click');
const Url = require('../models/Url');

const QUEUE_NAME = 'click_analytics';
const PREFETCH_COUNT = 10; // Process up to 10 messages concurrently before ack-ing

/**
 * Persists a click event to MongoDB.
 * Runs two writes in parallel: insert the click record and increment the click counter.
 */
const processClickEvent = async (payload) => {
  const { shortCode, ip, userAgent, referer, timestamp } = payload;

  await Promise.all([
    Click.create({ shortCode, ip, userAgent, referer, timestamp: timestamp || new Date() }),
    Url.updateOne({ shortCode }, { $inc: { clicks: 1 } }),
  ]);
};

const startWorker = async () => {
  await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 });
  console.log('[Worker] MongoDB connected');

  const connection = await amqplib.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });
  channel.prefetch(PREFETCH_COUNT);

  console.log(`[Worker] Listening on queue: ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      console.error('[Worker] Malformed message, discarding');
      channel.nack(msg, false, false); // Don't requeue unparseable messages
      return;
    }

    try {
      await processClickEvent(payload);
      channel.ack(msg);
    } catch (err) {
      console.error('[Worker] Failed to process click event:', err.message);
      // Requeue once; if it fails again the message goes to dead-letter or is discarded
      channel.nack(msg, false, msg.fields.redelivered === false);
    }
  });

  process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down gracefully...');
    await channel.close();
    await connection.close();
    await mongoose.connection.close();
    process.exit(0);
  });
};

startWorker().catch((err) => {
  console.error('[Worker] Startup failed:', err);
  process.exit(1);
});
