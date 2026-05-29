const { getChannel, QUEUE_NAME } = require('../config/rabbitmq');

/**
 * Publishes a click event to the analytics queue.
 * This is fire-and-forget: we never block the redirect response waiting for this.
 * If RabbitMQ is down, the error is logged and the request continues normally.
 */
const publishClickEvent = (payload) => {
  try {
    const channel = getChannel();
    const messageBuffer = Buffer.from(JSON.stringify(payload));

    // persistent: true ensures the message survives a RabbitMQ restart
    channel.sendToQueue(QUEUE_NAME, messageBuffer, { persistent: true });
  } catch (err) {
    // Non-blocking failure — analytics loss is acceptable vs. impacting redirect latency
    console.error('[Queue] Failed to publish click event:', err.message);
  }
};

module.exports = { publishClickEvent };
