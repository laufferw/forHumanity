const Request = require('../models/Request');

const DAY_MS = 24 * 60 * 60 * 1000;
const REDACTED = 'Redacted';

// RETENTION_DAYS=0 (or "off") disables automatic redaction.
const retentionDays = () => {
  const raw = process.env.RETENTION_DAYS;
  if (raw === 'off') return 0;
  const days = Number(raw ?? 90);
  return Number.isFinite(days) && days > 0 ? days : 0;
};

/**
 * Removes requesters' personal details from requests that were delivered or
 * cancelled more than `days` ago. Status and dates are kept for reporting.
 * Idempotent; returns the number of requests redacted.
 */
const redactClosedRequests = async ({ days = retentionDays(), now = new Date() } = {}) => {
  if (!days) return 0;
  const cutoff = new Date(now.getTime() - days * DAY_MS);

  const result = await Request.updateMany(
    {
      redactedAt: { $exists: false },
      $or: [
        { status: 'completed', completedAt: { $lt: cutoff } },
        { status: 'cancelled', updatedAt: { $lt: cutoff } },
      ],
    },
    {
      $set: {
        'user.name': REDACTED,
        'user.phone': REDACTED,
        'location.address': REDACTED,
        redactedAt: now,
      },
      $unset: { 'user.email': 1, notes: 1, 'location.coordinates': 1 },
    }
  );
  return result.modifiedCount || 0;
};

/** Runs the redaction now and then once a day. */
const scheduleRedaction = () => {
  const run = () =>
    redactClosedRequests()
      .then((count) => {
        if (count) {
          console.log(JSON.stringify({ level: 'info', type: 'retention', redacted: count }));
        }
      })
      .catch((err) =>
        console.error(JSON.stringify({ level: 'error', type: 'retention', message: err.message }))
      );

  run();
  setInterval(run, DAY_MS).unref();
};

module.exports = { redactClosedRequests, scheduleRedaction, retentionDays };
