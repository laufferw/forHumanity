const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = require('../middleware/auth');

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const MAX_FAILED_LOGIN_ATTEMPTS = parsePositiveInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS, 5);
const LOCKOUT_MINUTES = parsePositiveInt(process.env.LOGIN_LOCKOUT_MINUTES, 15);
const FAILED_ATTEMPT_TTL_MINUTES = parsePositiveInt(process.env.FAILED_ATTEMPT_TTL_MINUTES, 60);
const TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '1d';

const loginAttempts = new Map();

const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
};

const normalizeEmail = (email) =>
  String(email || '')
    .trim()
    .toLowerCase();

const isStrongPassword = (password) => {
  if (!password || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
};

const getPasswordPolicyMessage = () =>
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

const issueToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });

const serializeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.contactInfo?.phone,
  role: user.role,
  status: user.status,
});

const purgeExpiredLoginAttempts = () => {
  const now = Date.now();
  const ttlMs = FAILED_ATTEMPT_TTL_MINUTES * 60 * 1000;

  for (const [key, record] of loginAttempts.entries()) {
    const lockExpired = record.lockedUntil && record.lockedUntil <= now;
    const ttlExpired = now - (record.lastFailedAt || record.createdAt || now) > ttlMs;

    if (lockExpired || ttlExpired) {
      loginAttempts.delete(key);
    }
  }
};

const getLockState = (email) => {
  purgeExpiredLoginAttempts();

  const key = normalizeEmail(email);
  const record = loginAttempts.get(key);
  if (!record) return { key, locked: false };

  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    return { key, locked: true, retryMs: record.lockedUntil - Date.now() };
  }

  return { key, locked: false };
};

const registerFailedAttempt = (email) => {
  const key = normalizeEmail(email);
  const now = Date.now();
  const existing = loginAttempts.get(key) || { count: 0, lockedUntil: null, createdAt: now };
  const nextCount = existing.count + 1;

  const updated = {
    count: nextCount,
    lockedUntil: nextCount >= MAX_FAILED_LOGIN_ATTEMPTS ? now + LOCKOUT_MINUTES * 60 * 1000 : null,
    createdAt: existing.createdAt || now,
    lastFailedAt: now,
  };

  loginAttempts.set(key, updated);
  return updated;
};

const clearFailedAttempts = (email) => {
  loginAttempts.delete(normalizeEmail(email));
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all required fields' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: getPasswordPolicyMessage() });
    }

    const normalizedEmail = normalizeEmail(email);

    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    user = new User({
      name,
      email: normalizedEmail,
      password,
      contactInfo: {
        phone,
      },
      role: 'volunteer',
      status: 'active',
    });

    await user.save();

    const token = issueToken(user);

    return res.status(201).json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const lockState = getLockState(email);
    if (lockState.locked) {
      return res.status(429).json({
        message: 'Too many failed login attempts. Please try again later.',
        retryMinutes: Math.ceil(lockState.retryMs / 60000),
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      registerFailedAttempt(normalizedEmail);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res
        .status(400)
        .json({ message: 'Account is not active. Please contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const state = registerFailedAttempt(normalizedEmail);
      if (state.lockedUntil) {
        return res.status(429).json({
          message: 'Too many failed login attempts. Please try again later.',
          retryMinutes: LOCKOUT_MINUTES,
        });
      }
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    clearFailedAttempts(normalizedEmail);
    const token = issueToken(user);

    return res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/session/refresh', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Session is no longer valid.' });
    }

    const token = issueToken(user);
    return res.json({ token, user: serializeUser(user) });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(serializeUser(user));
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, phone, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (email && normalizeEmail(email) !== user.email) {
      const normalizedEmail = normalizeEmail(email);
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = normalizedEmail;
    }
    if (phone !== undefined) {
      user.contactInfo = {
        ...(user.contactInfo || {}),
        phone,
      };
    }

    if (currentPassword && newPassword) {
      if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ message: getPasswordPolicyMessage() });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.password = newPassword;
    }

    await user.save();

    return res.json({
      user: serializeUser(user),
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json(users.map(serializeUser));
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/volunteers', auth, adminAuth, async (req, res) => {
  try {
    const volunteers = await User.find({ role: 'volunteer' })
      .select('-password')
      .sort({ createdAt: -1 });
    return res.json(volunteers.map(serializeUser));
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, email, phone, role, status } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (email && normalizeEmail(email) !== user.email) {
      const normalizedEmail = normalizeEmail(email);
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = normalizedEmail;
    }
    if (phone !== undefined) {
      user.contactInfo = {
        ...(user.contactInfo || {}),
        phone,
      };
    }
    if (role) user.role = role;
    if (status) user.status = status;

    await user.save();

    return res.json(serializeUser(user));
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);
    return res.json({ message: 'User removed successfully' });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
