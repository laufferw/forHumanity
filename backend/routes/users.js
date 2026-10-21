const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Request = require('../models/Request');
const { canSignIn } = require('../utils/accounts');
const notifications = require('../services/notifications');

const auth = require('../middleware/auth');
const adminAuth = require('../middleware/requireAdmin');
const { sendError } = require('../utils/http');
const { isStrongPassword, PASSWORD_POLICY_MESSAGE } = require('../utils/password');

const VALID_ROLES = ['volunteer', 'admin'];
const VALID_STATUSES = ['active', 'inactive', 'pending', 'suspended'];
const NOT_FOUND = { notFoundMessage: 'User not found' };

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const MAX_FAILED_LOGIN_ATTEMPTS = parsePositiveInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS, 5);
const LOCKOUT_MINUTES = parsePositiveInt(process.env.LOGIN_LOCKOUT_MINUTES, 15);
const FAILED_ATTEMPT_TTL_MINUTES = parsePositiveInt(process.env.FAILED_ATTEMPT_TTL_MINUTES, 60);
const TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '1d';

const loginAttempts = new Map();

const normalizeEmail = (email) =>
  String(email || '')
    .trim()
    .toLowerCase();

// Puts a user's open assignments back in the queue so they don't stall when
// the user is deleted or can no longer take deliveries. Delivered and
// cancelled requests keep their assignee as history.
const releaseOpenAssignments = (userId) =>
  Request.updateMany(
    { assignedTo: userId, status: { $in: ['pending', 'in-progress'] } },
    { $unset: { assignedTo: 1 }, $set: { status: 'pending' } }
  );

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
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
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
      // New volunteers wait for an admin to approve them before they can be
      // assigned deliveries (and see requesters' contact details).
      status: 'pending',
    });

    await user.save();
    notifications.notify(notifications.volunteerAwaitingApproval(user));

    const token = issueToken(user);

    return res.status(201).json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
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

    // Checked only after the password matches, so account status can't be
    // used to discover which emails are registered.
    if (!canSignIn(user.status)) {
      return res
        .status(400)
        .json({ message: 'Account is not active. Please contact administrator.' });
    }

    clearFailedAttempts(normalizedEmail);
    const token = issueToken(user);

    return res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

router.post('/session/refresh', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !canSignIn(user.status)) {
      return res.status(401).json({ message: 'Session is no longer valid.' });
    }

    const token = issueToken(user);
    return res.json({ token, user: serializeUser(user) });
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
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
    return sendError(res, err, NOT_FOUND);
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
        return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
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
    return sendError(res, err, NOT_FOUND);
  }
});

router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json(users.map(serializeUser));
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

router.get('/volunteers', auth, adminAuth, async (req, res) => {
  try {
    const volunteers = await User.find({ role: 'volunteer' })
      .select('-password')
      .sort({ createdAt: -1 });
    return res.json(volunteers.map(serializeUser));
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, email, phone, role, status } = req.body;

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const isSelf = req.params.id === req.user.id;
    if (isSelf && ((role && role !== 'admin') || (status && status !== 'active'))) {
      return res
        .status(400)
        .json({ message: 'You cannot remove your own admin access or deactivate yourself' });
    }

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
    const leavingActive = status && status !== 'active' && user.status === 'active';
    const approved = status === 'active' && user.status === 'pending';
    if (status) user.status = status;

    await user.save();
    if (leavingActive) await releaseOpenAssignments(user.id);
    if (approved) notifications.notify(notifications.volunteerApproved(user));

    return res.json(serializeUser(user));
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);
    await releaseOpenAssignments(req.params.id);
    return res.json({ message: 'User removed successfully' });
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

module.exports = router;
