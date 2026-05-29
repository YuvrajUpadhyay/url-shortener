const { shortenUrl, resolveUrl, getAnalytics, listUrls, deactivateUrl } = require('../services/urlService');
const { isValidUrl, isValidAlias } = require('../utils/validators');

const shorten = async (req, res, next) => {
  try {
    const { originalUrl, customAlias, expiresInHours } = req.body;

    if (!originalUrl || !isValidUrl(originalUrl)) {
      return res.status(400).json({ error: 'A valid http/https URL is required' });
    }

    if (customAlias !== undefined && customAlias !== null && customAlias !== '') {
      if (!isValidAlias(customAlias)) {
        return res.status(400).json({
          error: 'Alias must be 3–30 characters: letters, numbers, hyphens, underscores only',
        });
      }
    }

    if (expiresInHours !== undefined) {
      const parsed = parseFloat(expiresInHours);
      if (isNaN(parsed) || parsed < 0.1) {
        return res.status(400).json({ error: 'expiresInHours must be a positive number (min 0.1)' });
      }
    }

    const urlDoc = await shortenUrl({
      originalUrl,
      customAlias: customAlias || undefined,
      expiresInHours: expiresInHours ? parseFloat(expiresInHours) : null,
    });

    return res.status(201).json({
      shortUrl: `${process.env.BASE_URL}/${urlDoc.shortCode}`,
      shortCode: urlDoc.shortCode,
      originalUrl: urlDoc.originalUrl,
      expiresAt: urlDoc.expiresAt,
      createdAt: urlDoc.createdAt,
    });
  } catch (err) {
    next(err);
  }
};

const redirect = async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    const requestMeta = {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || null,
      referer: req.headers['referer'] || null,
      timestamp: new Date(),
    };

    const originalUrl = await resolveUrl(shortCode, requestMeta);

    if (!originalUrl) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    // 301 for permanent redirects (cacheable by browsers); use 302 for analytics accuracy tradeoff
    return res.redirect(302, originalUrl);
  } catch (err) {
    next(err);
  }
};

const analytics = async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    const stats = await getAnalytics(shortCode);

    if (!stats) {
      return res.status(404).json({ error: 'No data found for this short code' });
    }

    return res.json(stats);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/urls?page=1&limit=20
 * Returns a paginated list of all active short URLs.
 */
const list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await listUrls({ page, limit });
    return res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/urls/:shortCode
 * Soft-deletes a short URL by setting isActive=false and removing it from cache.
 */
const deactivate = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const success = await deactivateUrl(shortCode);

    if (!success) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    return res.json({ message: `Short URL "${shortCode}" has been deactivated` });
  } catch (err) {
    next(err);
  }
};

module.exports = { shorten, redirect, analytics, list, deactivate };
