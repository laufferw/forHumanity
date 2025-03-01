const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import routes
const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forHumanity';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.log('Continuing without MongoDB connection');
  });

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running correctly!' });
});

// Define routes
app.get('/', (req, res) => {
  res.send('Welcome to the forHumanity API');
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Start server
console.log(`Attempting to start server on port ${PORT}`);
app.listen(PORT, () => {
  console.log(`Server successfully running on port ${PORT}`);
});

