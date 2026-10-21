process.env.JWT_SECRET = 'test-secret';

jest.mock('../middleware/auth', () => {
  const auth = (req, res, next) => {
    req.user = {
      id: req.header('x-test-user-id') || 'user-1',
      role: req.header('x-test-role') || 'volunteer',
      status: req.header('x-test-status') || 'active',
    };
    next();
  };
  auth.optional = (req, res, next) => {
    if (req.header('x-test-user-id')) {
      req.user = {
        id: req.header('x-test-user-id'),
        role: req.header('x-test-role') || 'volunteer',
        status: req.header('x-test-status') || 'active',
      };
    }
    next();
  };
  return auth;
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

const mockUserFindById = jest.fn();
jest.mock('../models/User', () => ({ findById: (...args) => mockUserFindById(...args) }));

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

  test('ignores userId in body and links request to the caller', async () => {
    const anon = await request(app).post('/api/requests').send({
      name: 'A',
      phone: '555',
      address: '1 St',
      userId: 'victim-user',
    });
    expect(anon.status).toBe(201);
    expect(anon.body.userId).toBeUndefined();

    const authed = await request(app)
      .post('/api/requests')
      .set('x-test-user-id', 'user-7')
      .send({ name: 'A', phone: '555', address: '1 St', userId: 'victim-user' });
    expect(authed.status).toBe(201);
    expect(authed.body.userId).toBe('user-7');
  });

  test('hides a request from users who are not owner, assignee, or admin', async () => {
    Request.findById.mockResolvedValue({ ...mockRequestDoc, userId: 'owner-1' });

    const stranger = await request(app).get('/api/requests/req-1').set('x-test-user-id', 'other');
    expect(stranger.status).toBe(404);

    const owner = await request(app).get('/api/requests/req-1').set('x-test-user-id', 'owner-1');
    expect(owner.status).toBe(200);

    const admin = await request(app)
      .get('/api/requests/req-1')
      .set('x-test-user-id', 'other')
      .set('x-test-role', 'admin');
    expect(admin.status).toBe(200);
  });

  test('only admins and the assignee can change status; owner may only cancel', async () => {
    const doc = () => ({
      ...mockRequestDoc,
      userId: 'owner-1',
      assignedTo: 'vol-1',
      save: jest.fn().mockResolvedValue(true),
    });
    const put = (userId, status) => {
      Request.findById.mockResolvedValue(doc());
      return request(app)
        .put('/api/requests/req-1/status')
        .set('x-test-user-id', userId)
        .send({ status });
    };

    expect((await put('other', 'completed')).status).toBe(403);
    expect((await put('owner-1', 'completed')).status).toBe(403);
    expect((await put('owner-1', 'cancelled')).status).toBe(200);
    expect((await put('vol-1', 'completed')).status).toBe(200);
  });

  test('lists requests assigned to the current user', async () => {
    const sort = jest.fn().mockResolvedValue([mockRequestDoc]);
    Request.find.mockReturnValue({ sort });

    const res = await request(app).get('/api/requests/assigned').set('x-test-user-id', 'vol-1');

    expect(res.status).toBe(200);
    expect(Request.find).toHaveBeenCalledWith({ assignedTo: 'vol-1' });
  });

  test('filters the admin list by status and rejects unknown statuses', async () => {
    Request.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    const ok = await request(app).get('/api/requests?status=pending').set('x-test-role', 'admin');
    expect(ok.status).toBe(200);
    expect(Request.find).toHaveBeenCalledWith({ status: 'pending' });

    const bad = await request(app).get('/api/requests?status=bogus').set('x-test-role', 'admin');
    expect(bad.status).toBe(400);
  });

  test('only assigns requests to active users', async () => {
    const assigneeId = '507f1f77bcf86cd799439011';
    const select = (value) => ({ select: jest.fn().mockResolvedValue(value) });
    Request.findById.mockResolvedValue({ ...mockRequestDoc, save: jest.fn() });

    mockUserFindById.mockReturnValue(select({ role: 'volunteer', status: 'suspended' }));
    const suspended = await request(app)
      .put('/api/requests/req-1')
      .set('x-test-role', 'admin')
      .send({ assignedTo: assigneeId });
    expect(suspended.status).toBe(400);

    const malformed = await request(app)
      .put('/api/requests/req-1')
      .set('x-test-role', 'admin')
      .send({ assignedTo: 'not-an-id' });
    expect(malformed.status).toBe(400);

    mockUserFindById.mockReturnValue(select({ role: 'volunteer', status: 'active' }));
    const active = await request(app)
      .put('/api/requests/req-1')
      .set('x-test-role', 'admin')
      .send({ assignedTo: assigneeId });
    expect(active.status).toBe(200);
    expect(active.body.assignedTo).toBe(assigneeId);
  });

  test('honeypot submissions look accepted but are not saved', async () => {
    const res = await request(app)
      .post('/api/requests')
      .send({ name: 'Bot', phone: '1', address: 'x', website: 'http://spam.example' });

    expect(res.status).toBe(201);
    // A saved request would come back with an _id from the mock model.
    expect(res.body._id).toBeUndefined();
  });

  test('pending admins cannot use admin-only request access', async () => {
    Request.findById.mockResolvedValue({ ...mockRequestDoc, userId: 'someone-else' });

    const res = await request(app)
      .get('/api/requests/req-1')
      .set('x-test-role', 'admin')
      .set('x-test-status', 'pending');
    expect(res.status).toBe(404);
  });
});
