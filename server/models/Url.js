const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: [true, 'Original URL is required'],
      trim: true,
      maxlength: [2048, 'URL must not exceed 2048 characters'],
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customAlias: {
      type: String,
      default: null,
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: String,
      default: 'anonymous',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Primary lookup index for redirect hot path
urlSchema.index({ shortCode: 1 }, { unique: true });

// Deduplication: same originalUrl by same user returns existing shortCode
urlSchema.index({ originalUrl: 1, createdBy: 1 });

// TTL index: MongoDB auto-removes expired documents (runs every 60s)
urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Url', urlSchema);
