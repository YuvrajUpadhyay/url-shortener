const Url = require('../models/Url');
const Click = require('../models/Click');
const { generateCode } = require('../utils/codeGenerator');
const { getCachedUrl, setCachedUrl, invalidateCache } = require('./cacheService');
const { publishClickEvent } = require('./queueService');

const MAX_CODE_COLLISION_RETRIES = 5;

/**
 * Shortens a URL. Handles deduplication, custom aliases, and expiry.
 *
 * Deduplication strategy: if the same user shortens the same URL without a custom alias,
 * return the existing short code instead of creating a duplicate.
 */
const shortenUrl = async ({ originalUrl, customAlias, expiresInHours, userId = 'anonymous' }) => {
  if (!customAlias) {
    const existing = await Url.findOne({ originalUrl, createdBy: userId, isActive: true });
    if (existing) return existing;
  }

  let shortCode = customAlias || generateCode();

  if (customAlias) {
    const conflict = await Url.exists({ shortCode: customAlias });
    if (conflict) {
      const err = new Error(`The alias "${customAlias}" is already taken`);
      err.statusCode = 409;
      throw err;
    }
  } else {
    // Collision resolution loop — with 62^7 combinations this is nearly impossible,
    // but handled correctly regardless
    let retries = 0;
    while (await Url.exists({ shortCode })) {
      shortCode = generateCode();
      if (++retries >= MAX_CODE_COLLISION_RETRIES) {
        throw new Error('Unable to generate a unique short code, please try again');
      }
    }
  }

  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
    : null;

  const urlDoc = await Url.create({
    originalUrl,
    shortCode,
    customAlias: customAlias || null,
    expiresAt,
    createdBy: userId,
  });

  const cacheTtl = expiresAt
    ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    : undefined;

  await setCachedUrl(shortCode, originalUrl, cacheTtl);

  return urlDoc;
};

/**
 * Resolves a shortCode to its original URL.
 * Implements cache-aside: check Redis, fall back to MongoDB, populate cache on miss.
 *
 * Click events are dispatched asynchronously via RabbitMQ — the redirect itself
 * never waits for analytics to be written to the database.
 */
const resolveUrl = async (shortCode, requestMeta) => {
  const cachedUrl = await getCachedUrl(shortCode);

  if (cachedUrl) {
    // Non-blocking direct writes — no worker needed
    Click.create({ shortCode, ...requestMeta }).catch(err =>
      console.error('[Analytics] Click insert failed:', err.message)
    );
    Url.updateOne({ shortCode }, { $inc: { clicks: 1 } }).catch(err =>
      console.error('[Analytics] Click increment failed:', err.message)
    );
    return cachedUrl;
  }

  const urlDoc = await Url.findOne({ shortCode, isActive: true });

  if (!urlDoc) return null;

  if (urlDoc.expiresAt && urlDoc.expiresAt < new Date()) {
    const err = new Error('This link has expired');
    err.statusCode = 410;
    throw err;
  }

  const cacheTtl = urlDoc.expiresAt
    ? Math.floor((urlDoc.expiresAt.getTime() - Date.now()) / 1000)
    : undefined;

  await setCachedUrl(shortCode, urlDoc.originalUrl, cacheTtl);

  // Non-blocking direct writes
  Click.create({ shortCode, ...requestMeta }).catch(err =>
    console.error('[Analytics] Click insert failed:', err.message)
  );
  Url.updateOne({ shortCode }, { $inc: { clicks: 1 } }).catch(err =>
    console.error('[Analytics] Click increment failed:', err.message)
  );

  return urlDoc.originalUrl;
};

/**
 * Returns analytics for a given short code:
 * total clicks (from Url doc) and last 100 individual click records.
 */
const getAnalytics = async (shortCode) => {
  const urlDoc = await Url.findOne({ shortCode }).select(
    'shortCode originalUrl clicks createdAt expiresAt isActive'
  );

  if (!urlDoc) return null;

  const recentClicks = await Click.find({ shortCode })
    .sort({ timestamp: -1 })
    .limit(100)
    .select('timestamp ip referer -_id');

  return {
    shortCode: urlDoc.shortCode,
    originalUrl: urlDoc.originalUrl,
    totalClicks: urlDoc.clicks,
    isActive: urlDoc.isActive,
    createdAt: urlDoc.createdAt,
    expiresAt: urlDoc.expiresAt,
    recentClicks,
  };
};

/**
 * Returns paginated list of short URLs, newest first.
 */
const listUrls = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;

  const [urls, total] = await Promise.all([
    Url.find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('shortCode originalUrl clicks createdAt expiresAt customAlias'),
    Url.countDocuments({ isActive: true }),
  ]);

  return {
    urls: urls.map((doc) => ({
      shortCode: doc.shortCode,
      shortUrl: `${process.env.BASE_URL}/${doc.shortCode}`,
      originalUrl: doc.originalUrl,
      clicks: doc.clicks,
      customAlias: doc.customAlias,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Soft-deletes a short URL by marking it inactive and removing it from Redis.
 * Returns true if the document was found and updated, false if not found.
 */
const deactivateUrl = async (shortCode) => {
  const result = await Url.findOneAndUpdate(
    { shortCode, isActive: true },
    { isActive: false },
    { new: false }
  );

  if (!result) return false;

  await invalidateCache(shortCode);
  return true;
};

module.exports = { shortenUrl, resolveUrl, getAnalytics, listUrls, deactivateUrl };
