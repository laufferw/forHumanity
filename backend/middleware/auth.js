const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { canSignIn } = require('../utils/accounts');
require('dotenv').config();

/**
 * Resolves the user for a token, or null when the token is invalid or the
 * account no longer exists / may not sign in. Role and status come from the
 * database so demotions and suspensions take effect immediately, not at
 * token expiry.
 */
const resolveUser = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }

  try {
    const user = await User.findById(decoded.id).select('role status');
    if (!user || !canSignIn(user.status)) return null;
    return { id: String(user.id), role: user.role, status: user.status };
  } catch {
    return null;
  }
};

/**
 * Authentication middleware to verify JWT tokens
 * Extracts token from request header, verifies it, and adds user info to request object
 */
const auth = async (req, res, next) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const user = await resolveUser(token);
  if (!user) {
    return res.status(401).json({ message: 'Token is not valid' });
  }

  req.user = user;
  return next();
};

/**
 * Like auth, but lets anonymous requests through. A missing or invalid token
 * leaves req.user unset instead of rejecting the request.
 */
auth.optional = async (req, res, next) => {
  const token = req.header('x-auth-token');
  if (token) {
    const user = await resolveUser(token);
    if (user) req.user = user;
  }
  return next();
};

module.exports = auth;
