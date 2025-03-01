const express = require('express');
const router = express.Router();
const Request = require('../models/Request');

// Middleware for checking if user is authenticated (placeholder)
const isAuthenticated = (req, res, next) => {
  // This would normally verify the user's JWT or session
  // For now, we'll just pass through
  next();
};

// Middleware for checking if user is admin (placeholder)
const isAdmin = (req, res, next) => {
  // This would normally check the user's role from JWT or session
  // For now, we'll just pass through
  next();
};

/**
 * @route   GET /api/requests
 * @desc    Get all requests (accessible to admins only)
 * @access  Private/Admin
 */
router.get('/', [isAuthenticated, isAdmin], async (req, res) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
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
router.get('/:id', isAuthenticated, async (req, res) => {
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
 * @route   GET /api/requests/user/:userId
 * @desc    Get requests by user ID (for users to see their own requests)
 * @access  Private
 */
router.get('/user/:userId', isAuthenticated, async (req, res) => {
  try {
    const requests = await Request.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    return res.json(requests);
  } catch (err) {
    console.error(err);
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
    const {
      name,
      email,
      phone,
      location,
      address,
      notes,
      userId
    } = req.body;

    // Basic validation
    if (!name || !phone || (!location && !address)) {
      return res.status(400).json({ message: 'Please provide name, contact information, and location' });
    }

    const newRequest = new Request({
      name,
      email,
      phone,
      location,
      address,
      notes,
      userId,
      status: 'pending' // Default status
    });

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
router.put('/:id', [isAuthenticated, isAdmin], async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      location,
      address,
      notes,
      status,
      assignedTo
    } = req.body;

    // Find request by ID
    let request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Build update object with only provided fields
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (phone) updateFields.phone = phone;
    if (location) updateFields.location = location;
    if (address) updateFields.address = address;
    if (notes) updateFields.notes = notes;
    if (status) updateFields.status = status;
    if (assignedTo) updateFields.assignedTo = assignedTo;

    // Update the request
    request = await Request.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

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
 * @desc    Update a request's status (simplified endpoint for volunteers)
 * @access  Private
 */
router.put('/:id/status', isAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Validate status value
    const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Find and update the request
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );

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
 * @route   DELETE /api/requests/:id
 * @desc    Delete a request
 * @access  Private/Admin
 */
router.delete('/:id', [isAuthenticated, isAdmin], async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    await Request.findByIdAndRemove(req.params.id);
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

