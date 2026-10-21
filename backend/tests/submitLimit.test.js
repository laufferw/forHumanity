process.env.JWT_SECRET = 'test-secret';
process.env.REQUEST_RATE_LIMIT_MAX = '2';

jest.mock('../middleware/auth', () => {
  const auth = (req, res, next) => next();
  auth.optional = (req, res, next) => next();
  return auth;
});

function MockRequest(payload) {
  return { ...payload, save: jest.fn().mockResolvedValue({ _id: 'r', ...payload }) };
}
jest.mock('../models/Request', () => MockRequest);

const request = require('supertest');
const { app } = require('../server');

test('limits public request submissions per IP', async () => {
  const submit = () =>
    request(app).post('/api/requests').send({ name: 'A', phone: '1', address: 'Main St' });

  expect((await submit()).status).toBe(201);
  expect((await submit()).status).toBe(201);

  const blocked = await submit();
  expect(blocked.status).toBe(429);
  expect(blocked.body.message).toMatch(/too many requests submitted/i);
});
