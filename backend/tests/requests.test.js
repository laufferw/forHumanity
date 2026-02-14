process.env.JWT_SECRET = 'test-secret';

jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = {
    id: req.header('x-test-user-id') || 'user-1',
    role: req.header('x-test-role') || 'volunteer',
  };
  next();
});

const mockRequestDoc = {
  _id: 'req-1',
  status: 'pending',
  user: { name: 'William', email: 'w@test.com', phone: '555' },
  location: { address: '123 Main St' },
  save: jest.fn().mockResolvedValue(true),
};

const Request = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

function MockRequest(payload) {
  return {
    ...payload,
    _id: 'new-req-1',
    save: jest.fn().mockResolvedValue({ _id: 'new-req-1', ...payload }),
  };
}

MockRequest.find = Request.find;
MockRequest.findById = Request.findById;
MockRequest.findByIdAndDelete = Request.findByIdAndDelete;

jest.mock('../models/Request', () => MockRequest);

const request = require('supertest');
const { app } = require('../server');

describe('requests routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a request with legacy payload', async () => {
    const res = await request(app).post('/api/requests').send({
      name: 'William',
      phone: '555',
      address: '123 Main St',
      notes: 'Need support',
    });

    expect(res.status).toBe(201);
    expect(res.body.location.address).toBe('123 Main St');
    expect(res.body.status).toBe('pending');
  });

  test('blocks admin list route for non-admin users', async () => {
    const res = await request(app).get('/api/requests');
    expect(res.status).toBe(403);
  });

  test('allows admin to list all requests', async () => {
    Request.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([mockRequestDoc]) });

    const res = await request(app).get('/api/requests').set('x-test-role', 'admin');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('updates status and stamps completedAt', async () => {
    Request.findById.mockResolvedValue({
      ...mockRequestDoc,
      save: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .put('/api/requests/req-1/status')
      .set('x-test-role', 'admin')
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.completedAt).toBeTruthy();
  });

  test('preserves completedAt for idempotent completed status updates', async () => {
    const originalCompletedAt = new Date('2026-01-01T00:00:00.000Z');
    Request.findById.mockResolvedValue({
      ...mockRequestDoc,
      status: 'completed',
      completedAt: originalCompletedAt,
      save: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .put('/api/requests/req-1/status')
      .set('x-test-role', 'admin')
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(new Date(res.body.completedAt).toISOString()).toBe(originalCompletedAt.toISOString());
  });
});
