const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
let isConnected = false;

function validateRuntimeConfig() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me') {
      throw new Error('JWT_SECRET must be set to a strong value in production.');
    }
  }
}

app.set('trust proxy', process.env.TRUST_PROXY === 'true');
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
    console.log('Continuing without MongoDB connection');
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'forHumanity-backend',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
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
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
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
  });
}

module.exports = { app, connectDb, validateRuntimeConfig };
