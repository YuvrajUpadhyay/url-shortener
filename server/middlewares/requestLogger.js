const requestLogger = (req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const logLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';

    console.log(
      `[${logLevel}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs.toFixed(2)}ms`
    );
  });

  next();
};

module.exports = requestLogger;
