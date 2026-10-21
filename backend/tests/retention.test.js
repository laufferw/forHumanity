const mockUpdateMany = jest.fn();
jest.mock('../models/Request', () => ({ updateMany: (...args) => mockUpdateMany(...args) }));

const { redactClosedRequests, retentionDays } = require('../services/retention');

const now = new Date('2026-06-01T00:00:00Z');

beforeEach(() => {
  mockUpdateMany.mockReset().mockResolvedValue({ modifiedCount: 3 });
  delete process.env.RETENTION_DAYS;
});

test('redacts personal details of requests closed before the cutoff', async () => {
  const count = await redactClosedRequests({ days: 90, now });
  expect(count).toBe(3);

  const [filter, update] = mockUpdateMany.mock.calls[0];
  const cutoff = new Date('2026-03-03T00:00:00Z');
  expect(filter).toEqual({
    redactedAt: { $exists: false },
    $or: [
      { status: 'completed', completedAt: { $lt: cutoff } },
      { status: 'cancelled', updatedAt: { $lt: cutoff } },
    ],
  });
  expect(update.$set).toMatchObject({
    'user.name': 'Redacted',
    'user.phone': 'Redacted',
    'location.address': 'Redacted',
    redactedAt: now,
  });
  expect(update.$unset).toEqual({ 'user.email': 1, notes: 1, 'location.coordinates': 1 });
});

test('defaults to 90 days and can be turned off', async () => {
  expect(retentionDays()).toBe(90);
  process.env.RETENTION_DAYS = '30';
  expect(retentionDays()).toBe(30);

  process.env.RETENTION_DAYS = 'off';
  expect(await redactClosedRequests({ now })).toBe(0);
  process.env.RETENTION_DAYS = '0';
  expect(await redactClosedRequests({ now })).toBe(0);
  expect(mockUpdateMany).not.toHaveBeenCalled();
});
