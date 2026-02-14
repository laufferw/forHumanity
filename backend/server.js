const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
let isConnected = false;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

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
  connectDb().finally(() => {
    app.listen(PORT, () => {
      console.log(`Server successfully running on port ${PORT}`);
    });
  });
}

module.exports = { app, connectDb };
