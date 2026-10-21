/**
 * Maps errors thrown by route handlers to a JSON response: Mongoose
 * validation errors become 400s, malformed IDs become 404s (or 400s when no
 * not-found message is given), and anything else is logged and returned as a
 * generic 500 without internal details.
 */
const sendError = (res, err, { notFoundMessage } = {}) => {
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(' ');
    return res.status(400).json({ message });
  }

  if (err.name === 'CastError' || err.kind === 'ObjectId') {
    if (notFoundMessage) {
      return res.status(404).json({ message: notFoundMessage });
    }
    return res.status(400).json({ message: `Invalid value for ${err.path || 'id'}` });
  }

  console.error(err);
  return res.status(500).json({ message: 'Server error' });
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = { sendError, EMAIL_PATTERN };
