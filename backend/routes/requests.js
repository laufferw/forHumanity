const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const auth = require('../middleware/auth');

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
      address: location.address || address || ''
    };

    if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      normalized.coordinates = {
        type: 'Point',
        coordinates: location.coordinates
      };
    }

    return normalized;
  }

  return {
    address: address || location || ''
  };
};

/**
 * @route   GET /api/requests
 * @desc    Get all requests (admins only)
 * @access  Private/Admin
 */
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   GET /api/requests/user
 * @desc    Get requests for the currently authenticated user
 * @access  Private
 */
router.get('/user', auth, async (req, res) => {
  try {
    const requests = await Request.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
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
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   GET /api/requests/:id
 * @desc    Get request by ID
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    return res.json(request);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Request not found' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   POST /api/requests
 * @desc    Create a new request
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, location, address, notes, userId } = req.body;

    if (!name || !phone || (!location && !address)) {
      return res.status(400).json({ message: 'Please provide name, phone, and location/address' });
    }

    const requestPayload = {
      user: {
        name,
        email: email || 'unknown@example.com',
        phone
      },
      location: normalizeLocation({ location, address }),
      notes,
      userId,
      status: 'pending'
    };

    const newRequest = new Request(requestPayload);
    const request = await newRequest.save();
    return res.status(201).json(request);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
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

    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (name) request.user.name = name;
    if (email) request.user.email = email;
    if (phone) request.user.phone = phone;
    if (location || address) request.location = normalizeLocation({ location, address });
    if (notes !== undefined) request.notes = notes;
    if (status) request.status = status;
    if (assignedTo) request.assignedTo = assignedTo;

    await request.save();
    return res.json(request);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Request not found' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   PUT /api/requests/:id/status
 * @desc    Update request status
 * @access  Private
 */
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = status;
    await request.save();

    return res.json(request);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Request not found' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   DELETE /api/requests/:id
 * @desc    Delete request
 * @access  Private/Admin
 */
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    await Request.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Request removed' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Request not found' });
    }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
