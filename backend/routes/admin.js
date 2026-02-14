const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Request = require('../models/Request');
const auth = require('../middleware/auth');

const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
};

router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const [userCount, totalRequests, pendingRequests, completedRequests] = await Promise.all([
      User.countDocuments(),
      Request.countDocuments(),
      Request.countDocuments({ status: 'pending' }),
      Request.countDocuments({ status: 'completed' }),
    ]);

    return res.json({
      users: userCount,
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        completed: completedRequests,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
