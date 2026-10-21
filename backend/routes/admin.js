const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Request = require('../models/Request');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/requireAdmin');
const { sendError } = require('../utils/http');

router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const [
      userCount,
      pendingUsers,
      totalRequests,
      pendingRequests,
      inProgressRequests,
      completedRequests,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'pending' }),
      Request.countDocuments(),
      Request.countDocuments({ status: 'pending' }),
      Request.countDocuments({ status: 'in-progress' }),
      Request.countDocuments({ status: 'completed' }),
    ]);

    return res.json({
      users: userCount,
      pendingUsers,
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
