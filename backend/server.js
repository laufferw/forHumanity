const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');
const { scheduleRedaction } = require('./services/retention');

const app = express();
const PORT = process.env.PORT || 5000;
let isConnected = false;
const processStartedAt = Date.now();

const metrics = {
  requestsTotal: 0,
  requestsByStatus: {},
  requestsByMethod: {},
  requestsByRoute: {},
  errorsTotal: 0,
  errorsByCode: {},
};

function incrementMetric(bucket, key) {
  bucket[key] = (bucket[key] || 0) + 1;
}

function validateRuntimeConfig() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me') {
      throw new Error('JWT_SECRET must be set to a strong value in production.');
    }
  }
}

// TRUST_PROXY is the number of reverse proxies in front of the app (the
// bundled nginx counts as one). Trusting every hop ('true' in Express) would
// let clients spoof X-Forwarded-For and dodge rate limiting, so a legacy
// 'true' value is treated as a single hop.
function parseTrustProxy(value) {
  if (value === 'true') return 1;
  const hops = Number(value);
  return Number.isInteger(hops) && hops > 0 ? hops : false;
}

app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    metrics.requestsTotal += 1;
    incrementMetric(metrics.requestsByStatus, String(res.statusCode));
    incrementMetric(metrics.requestsByMethod, req.method);
    // Key by the matched route pattern (e.g. /api/requests/:id), not the raw
    // path, so unmatched or ID-bearing URLs can't grow this map without bound.
    const routeKey = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    incrementMetric(metrics.requestsByRoute, routeKey);

    if (res.statusCode >= 500) {
      metrics.errorsTotal += 1;
      incrementMetric(metrics.errorsByCode, String(res.statusCode));
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        level: 'info',
        type: 'request',
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        statusCode: res.statusCode,
        durationMs,
      })
    );
  });

  next();
});

app.use('/api', apiLimiter);

async function connectDb() {
  if (isConnected) return;

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forHumanity';
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('Connected to MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // In production, exit so the container restarts instead of serving
    // requests that will all fail.
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    console.log('Continuing without MongoDB connection');
  }
}

app.get('/api/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    service: 'forHumanity-backend',
    db: dbConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

// When METRICS_TOKEN is set, callers must send it in x-metrics-token.
// Without it, metrics stay open in development but are disabled in production.
const metricsAuth = (req, res, next) => {
  const expected = process.env.METRICS_TOKEN;
  if (expected) {
    const provided = Buffer.from(String(req.header('x-metrics-token') || ''));
    const wanted = Buffer.from(expected);
    if (provided.length === wanted.length && crypto.timingSafeEqual(provided, wanted)) {
      return next();
    }
    return res.status(401).json({ message: 'Metrics token required', requestId: req.requestId });
  }
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Route not found', requestId: req.requestId });
  }
  return next();
};

app.get('/api/metrics', metricsAuth, (req, res) => {
  res.json({
    status: 'ok',
    service: 'forHumanity-backend',
    startedAt: new Date(processStartedAt).toISOString(),
    uptimeSeconds: Math.floor((Date.now() - processStartedAt) / 1000),
    requests: {
      total: metrics.requestsTotal,
      byStatus: metrics.requestsByStatus,
      byMethod: metrics.requestsByMethod,
      byRoute: metrics.requestsByRoute,
    },
    errors: {
      total: metrics.errorsTotal,
      byCode: metrics.errorsByCode,
    },
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running correctly!' });
});

app.get('/', (req, res) => {
  res.send('Welcome to the forHumanity API');
});

app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found', requestId: req.requestId });
});

app.use((err, req, res, _next) => {
  const statusCode = Number(err.statusCode || err.status || 500);
  const errorId = crypto.randomUUID();

  metrics.errorsTotal += 1;
  incrementMetric(metrics.errorsByCode, String(statusCode));

  console.error(
    JSON.stringify({
      level: 'error',
      type: 'unhandled_error',
      errorId,
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      statusCode,
      message: err.message,
      stack: err.stack,
    })
  );

  res.status(statusCode).json({
    message: 'Something went wrong!',
    errorId,
    requestId: req.requestId,
    error: process.env.NODE_ENV === 'production' ? {} : err,
  });
});

if (require.main === module) {
  console.log(`Attempting to start server on port ${PORT}`);
  validateRuntimeConfig();
  connectDb().finally(() => {
    app.listen(PORT, () => {
      console.log(`Server successfully running on port ${PORT}`);
    });
    if (process.env.RETENTION_SCHEDULE !== 'off') scheduleRedaction();
  });
}

module.exports = { app, connectDb, validateRuntimeConfig, parseTrustProxy };
