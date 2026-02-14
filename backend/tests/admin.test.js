jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = {
    id: 'admin-1',
    role: req.header('x-test-role') || 'volunteer',
  };
  next();
});

const mockUserModel = {
  countDocuments: jest.fn(),
};

const mockRequestModel = {
  countDocuments: jest.fn(),
};

jest.mock('../models/User', () => mockUserModel);
jest.mock('../models/Request', () => mockRequestModel);

const request = require('supertest');
const { app } = require('../server');

describe('admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks dashboard for non-admin users', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(403);
  });

  test('returns dashboard counts for admin users', async () => {
    mockUserModel.countDocuments.mockResolvedValueOnce(10);
    mockRequestModel.countDocuments.mockResolvedValueOnce(25);
    mockRequestModel.countDocuments.mockResolvedValueOnce(6);
    mockRequestModel.countDocuments.mockResolvedValueOnce(12);

    const res = await request(app).get('/api/admin/dashboard').set('x-test-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.users).toBe(10);
    expect(res.body.requests.total).toBe(25);
    expect(res.body.requests.pending).toBe(6);
    expect(res.body.requests.completed).toBe(12);
  });
});
