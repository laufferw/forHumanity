/**
 * Allows only active admins. Must run after the auth middleware.
 */
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin' && req.user.status === 'active') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
};

module.exports = requireAdmin;
