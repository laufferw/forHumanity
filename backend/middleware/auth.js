const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Authentication middleware to verify JWT tokens
 * Extracts token from request header, verifies it, and adds user info to request object
 */
const auth = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user from payload to request object
    req.user = {
      id: decoded.id,
      role: decoded.role
    };
    
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = auth;

