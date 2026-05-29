/**
 * Polls a condition function with exponential backoff until it resolves or times out.
 * Used during startup to wait for infrastructure services to become ready.
 */
const waitFor = async (label, checkFn, { maxRetries = 15, baseDelayMs = 500 } = {}) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await checkFn();
      console.log(`[Startup] ${label} is ready`);
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        throw new Error(`[Startup] ${label} failed to become ready after ${maxRetries} attempts: ${err.message}`);
      }
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), 8000);
      console.log(`[Startup] Waiting for ${label} (attempt ${attempt}/${maxRetries}, retry in ${delay}ms)...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

module.exports = { waitFor };
