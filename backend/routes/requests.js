const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Request = require('../models/Request');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendError } = require('../utils/http');

const VALID_STATUSES = ['pending', 'in-progress', 'completed', 'cancelled'];
const NOT_FOUND = { notFoundMessage: 'Request not found' };

const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
};

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

const isAdmin = (user) => user.role === 'admin';
const isOwner = (request, user) => sameId(request.userId, user.id);
const isAssignee = (request, user) => sameId(request.assignedTo, user.id);

const applyCompletionTimestampTransition = (request, nextStatus) => {
  const previousStatus = request.status;

  if (nextStatus === 'completed' && previousStatus !== 'completed') {
    request.completedAt = new Date();
  }

  if (nextStatus !== 'completed' && previousStatus === 'completed') {
    request.completedAt = undefined;
  }

  request.status = nextStatus;
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
router.post('/', auth.optional, async (req, res) => {
  try {
    const { name, email, phone, location, address, notes } = req.body;

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

    if (assignedTo) {
      const assignee = mongoose.isValidObjectId(assignedTo)
        ? await User.findById(assignedTo).select('role status')
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
    if (status) {
      applyCompletionTimestampTransition(request, status);
    }
    if (assignedTo !== undefined) request.assignedTo = assignedTo || undefined;

    await request.save();
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

    applyCompletionTimestampTransition(request, status);
    await request.save();

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
