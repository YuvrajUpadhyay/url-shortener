const mongoose = require('mongoose');

const connectDB = async () => {
  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 20,
  });

  console.log(`[DB] MongoDB connected: ${conn.connection.host}`);

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected');
  });
};

module.exports = connectDB;
