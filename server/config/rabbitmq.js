const amqplib = require('amqplib');

let connection = null;
let channel = null;

const QUEUE_NAME = 'click_analytics';

const connectRabbitMQ = async () => {
  connection = await amqplib.connect(process.env.RABBITMQ_URL);

  connection.on('error', (err) => console.error('[RabbitMQ] Connection error:', err.message));
  connection.on('close', () => console.warn('[RabbitMQ] Connection closed'));

  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log('[RabbitMQ] Connected and queue asserted');
  return { connection, channel };
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel is not initialized');
  }
  return channel;
};

module.exports = { connectRabbitMQ, getChannel, QUEUE_NAME };
