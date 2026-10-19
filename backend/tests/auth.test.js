process.env.JWT_SECRET = 'test-secret';

const mockFindById = jest.fn();
jest.mock('../models/User', () => ({ findById: (...args) => mockFindById(...args) }));

const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

const run = async (middleware, token) => {
  const req = { header: (name) => (name === 'x-auth-token' ? token : undefined) };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  await middleware(req, res, next);
  return { req, res, next };
};

const dbUser = (fields) => ({ select: jest.fn().mockResolvedValue(fields) });

describe('auth middleware', () => {
  beforeEach(() => mockFindById.mockReset());

  test('rejects a missing token', async () => {
    const { res, next } = await run(auth, undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('uses the role from the database, not the token', async () => {
    mockFindById.mockReturnValue(dbUser({ id: 'u1', role: 'volunteer', status: 'active' }));
    const token = jwt.sign({ id: 'u1', role: 'admin' }, 'test-secret');

    const { req, next } = await run(auth, token);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'u1', role: 'volunteer' });
  });

  test('rejects tokens for suspended or deleted users', async () => {
    const token = jwt.sign({ id: 'u1', role: 'admin' }, 'test-secret');

    mockFindById.mockReturnValue(dbUser({ id: 'u1', role: 'admin', status: 'suspended' }));
    expect((await run(auth, token)).res.status).toHaveBeenCalledWith(401);

    mockFindById.mockReturnValue(dbUser(null));
    expect((await run(auth, token)).res.status).toHaveBeenCalledWith(401);
  });

  test('optional auth lets anonymous and invalid-token requests through without a user', async () => {
    const anon = await run(auth.optional, undefined);
    expect(anon.next).toHaveBeenCalled();
    expect(anon.req.user).toBeUndefined();

    const bad = await run(auth.optional, 'not-a-jwt');
    expect(bad.next).toHaveBeenCalled();
    expect(bad.req.user).toBeUndefined();
  });
});
