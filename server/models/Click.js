const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema(
  {
    shortCode: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    referer: {
      type: String,
      default: null,
    },
  },
  {
    versionKey: false,
    // No createdAt/updatedAt overhead — timestamp field handles it
    timestamps: false,
  }
);

// Supports analytics queries: "give me all clicks for X, newest first"
clickSchema.index({ shortCode: 1, timestamp: -1 });

module.exports = mongoose.model('Click', clickSchema);
