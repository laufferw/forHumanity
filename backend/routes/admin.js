const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Request = require('../models/Request');
const auth = require('../middleware/auth');
const { sendError } = require('../utils/http');

const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
};

router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const [userCount, totalRequests, pendingRequests, inProgressRequests, completedRequests] =
      await Promise.all([
        User.countDocuments(),
        Request.countDocuments(),
        Request.countDocuments({ status: 'pending' }),
        Request.countDocuments({ status: 'in-progress' }),
        Request.countDocuments({ status: 'completed' }),
      ]);

    return res.json({
      users: userCount,
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        inProgress: inProgressRequests,
        completed: completedRequests,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
