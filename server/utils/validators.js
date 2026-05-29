const { URL } = require('url');

/**
 * Validates that a URL string is a parseable http/https URL.
 * Rejects data:, javascript:, ftp:, and other unsafe protocols.
 */
const isValidUrl = (raw) => {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Custom aliases: alphanumeric, hyphens, underscores, 3–30 chars.
 * Prevents path traversal, injection, or ambiguous codes.
 */
const isValidAlias = (alias) => {
  return typeof alias === 'string' && /^[a-zA-Z0-9_-]{3,30}$/.test(alias);
};

module.exports = { isValidUrl, isValidAlias };
