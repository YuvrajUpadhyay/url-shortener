const express = require('express');
const cors = require('cors');

const { redirect } = require('./controllers/urlController');
const { healthCheck } = require('./controllers/healthController');
const urlRoutes = require('./routes/urlRoutes');
const errorHandler = require('./middlewares/errorHandler');
const rateLimiter = require('./middlewares/rateLimiter');
const requestLogger = require('./middlewares/requestLogger');

const app = express();

app.set('trust proxy', 1); // Required for correct req.ip behind reverse proxies (nginx, etc.)

app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(requestLogger);

// Health check — bypasses rate limiter so monitors don't consume quota
app.get('/health', healthCheck);

// Short URL redirect — intentionally at root level for clean URLs (e.g. localhost:5000/abc1234)
app.get('/:shortCode', rateLimiter, redirect);

// REST API
app.use('/api', rateLimiter, urlRoutes);

// Must be registered after all routes
app.use(errorHandler);

module.exports = app;
