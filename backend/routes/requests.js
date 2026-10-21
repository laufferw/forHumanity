const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const router = express.Router();
const Request = require('../models/Request');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/requireAdmin');
const { sendError } = require('../utils/http');
const notifications = require('../services/notifications');

const VALID_STATUSES = ['pending', 'in-progress', 'completed', 'cancelled'];
const NOT_FOUND = { notFoundMessage: 'Request not found' };

// Public submissions get a much tighter per-IP limit than the general API
// limiter, since the form needs no account.
const submitLimiter = rateLimit({
  windowMs: Number(process.env.REQUEST_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000),
  max: Number(process.env.REQUEST_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests submitted. Please try again later.' },
});

const normalizeLocation = ({ location, address }) => {
  // Support legacy payloads where location is a free-text field
  // and newer payloads where location is an object.
  if (location && typeof location === 'object') {
    const normalized = {
      address: location.address || address || '',
    };

    if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      normalized.coordinates = {
        type: 'Point',
        coordinates: location.coordinates.map(Number),
      };
    }

    return normalized;
  }

  return {
    address: address || location || '',
  };
};

const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);

const isAdmin = (user) => user.role === 'admin' && user.status === 'active';
const isOwner = (request, user) => sameId(request.userId, user.id);
// Only active volunteers act as assignees. A volunteer moved back to pending
// keeps their delivered/cancelled history attached, but must not regain access
// to it (or reopen it) until approved again.
const isAssignee = (request, user) =>
  user.status === 'active' && sameId(request.assignedTo, user.id);

/**
 * Applies a status change, keeping completedAt and cancelledAt in step with
 * it. Returns true when the requester should be emailed that the request was
 * delivered: only the first time it completes, even if it's later reopened
 * and completed again.
 */
const applyStatusTransition = (request, nextStatus) => {
  const previousStatus = request.status;
  const now = new Date();
  const newlyCompleted = nextStatus === 'completed' && previousStatus !== 'completed';

  if (newlyCompleted) {
    request.completedAt = now;
  }
  if (nextStatus !== 'completed' && previousStatus === 'completed') {
    request.completedAt = undefined;
  }

  // Retention counts from cancellation, not from later edits (updatedAt).
  if (nextStatus === 'cancelled' && previousStatus !== 'cancelled') {
    request.cancelledAt = now;
  }
  if (nextStatus !== 'cancelled' && previousStatus === 'cancelled') {
    request.cancelledAt = undefined;
  }

  request.status = nextStatus;

  const notifyDelivered = newlyCompleted && !request.deliveryNotifiedAt;
  if (notifyDelivered) request.deliveryNotifiedAt = now;
  return notifyDelivered;
};

/**
 * @route   GET /api/requests
 * @desc    Get all requests, optionally filtered by ?status= (admins only)
 * @access  Private/Admin
 */
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const requests = await Request.find(status ? { status } : {}).sort({ createdAt: -1 });
    return res.json(requests);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * @route   GET /api/requests/user
 * @desc    Get requests submitted by the currently authenticated user
 * @access  Private
 */
router.get('/user', auth, async (req, res) => {
  try {
    const requests = await Request.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json(requests);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * @route   GET /api/requests/assigned
 * @desc    Get requests assigned to the currently authenticated volunteer
 * @access  Private
 */
router.get('/assigned', auth, async (req, res) => {
  try {
    if (req.user.status !== 'active') {
      return res.json([]);
    }

    const requests = await Request.find({ assignedTo: req.user.id }).sort({ createdAt: -1 });
    return res.json(requests);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * @route   GET /api/requests/user/:userId
 * @desc    Get requests by user ID (admins only)
 * @access  Private/Admin
 */
router.get('/user/:userId', auth, adminAuth, async (req, res) => {
  try {
    const requests = await Request.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    return res.json(requests);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * @route   GET /api/requests/:id
 * @desc    Get request by ID
 * @access  Private (admin, the requester, or the assigned volunteer)
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    // Respond 404 rather than 403 so request IDs can't be probed.
    if (
      !request ||
      !(isAdmin(req.user) || isOwner(request, req.user) || isAssignee(request, req.user))
    ) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.json(request);
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

/**
 * @route   POST /api/requests
 * @desc    Create a new request
 * @access  Public (linked to the caller's account when a valid token is sent)
 */
router.post('/', submitLimiter, auth.optional, async (req, res) => {
  try {
    const { name, email, phone, location, address, notes, website } = req.body;

    // Honeypot: `website` is a field people never see. Bots that fill every
    // input get a normal-looking response but nothing is saved.
    if (website) {
      return res.status(201).json({ status: 'pending' });
    }

    if (!name || !phone || (!location && !address)) {
      return res.status(400).json({ message: 'Please provide name, phone, and location/address' });
    }

    const requestPayload = {
      user: {
        name,
        email: email || undefined,
        phone,
      },
      location: normalizeLocation({ location, address }),
      notes,
      userId: req.user?.id,
      status: 'pending',
    };

    const newRequest = new Request(requestPayload);
    const request = await newRequest.save();
    return res.status(201).json(request);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * @route   PUT /api/requests/:id
 * @desc    Update a request
 * @access  Private/Admin
 */
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, email, phone, location, address, notes, status, assignedTo } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    let assignee = null;
    if (assignedTo) {
      assignee = mongoose.isValidObjectId(assignedTo)
        ? await User.findById(assignedTo).select('name email role status')
        : null;
      if (!assignee || assignee.status !== 'active') {
        return res.status(400).json({ message: 'Assignee must be an active user' });
      }
    }

    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (name) request.user.name = name;
    if (email) request.user.email = email;
    if (phone) request.user.phone = phone;
    if (location || address) request.location = normalizeLocation({ location, address });
    if (notes !== undefined) request.notes = notes;
    const notifyDelivered = status ? applyStatusTransition(request, status) : false;
    const newlyAssigned = Boolean(assignee) && !sameId(request.assignedTo, assignee.id);
    if (assignedTo !== undefined) request.assignedTo = assignedTo || undefined;

    await request.save();
    if (newlyAssigned) notifications.notify(notifications.volunteerAssigned(request, assignee));
    if (notifyDelivered) notifications.notify(notifications.requestDelivered(request));
    return res.json(request);
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

/**
 * @route   PUT /api/requests/:id/status
 * @desc    Update request status
 * @access  Private (admin or assigned volunteer; the requester may only cancel)
 */
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const canUpdate =
      isAdmin(req.user) ||
      isAssignee(request, req.user) ||
      (isOwner(request, req.user) && status === 'cancelled');
    if (!canUpdate) {
      return res.status(403).json({ message: 'Not allowed to update this request' });
    }

    const notifyDelivered = applyStatusTransition(request, status);
    await request.save();
    if (notifyDelivered) notifications.notify(notifications.requestDelivered(request));

    return res.json(request);
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

/**
 * @route   DELETE /api/requests/:id
 * @desc    Delete request
 * @access  Private/Admin
 */
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const request = await Request.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.json({ message: 'Request removed' });
  } catch (err) {
    return sendError(res, err, NOT_FOUND);
  }
});

module.exports = router;
