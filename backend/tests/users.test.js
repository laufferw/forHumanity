process.env.JWT_SECRET = 'test-secret';

jest.mock('../middleware/auth', () => {
  const auth = (req, res, next) => {
    req.user = {
      id: req.header('x-test-user-id') || 'admin-1',
      role: req.header('x-test-role') || 'admin',
    };
    next();
  };
  auth.optional = (req, res, next) => next();
  return auth;
});

const User = {
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

let mockSaveError = null;

function MockUser(payload) {
  return {
    ...payload,
    id: payload.id || 'user-123',
    save: jest.fn(() => (mockSaveError ? Promise.reject(mockSaveError) : Promise.resolve(true))),
  };
}

MockUser.findOne = User.findOne;
MockUser.findById = User.findById;
MockUser.find = User.find;
MockUser.findByIdAndDelete = User.findByIdAndDelete;

jest.mock('../models/User', () => MockUser);
const bcrypt = require('bcrypt');
jest.mock('bcrypt', () => ({ compare: jest.fn().mockResolvedValue(true) }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('token-123') }));

const request = require('supertest');
const { app } = require('../server');

describe('users routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registers a new user', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/users/register').send({
      name: 'William',
      email: 'william@test.com',
      password: 'Password123!',
      phone: '555',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBe('token-123');
    expect(res.body.user.email).toBe('william@test.com');
  });

  test('prevents duplicate registration', async () => {
    User.findOne.mockResolvedValue({ id: 'existing' });

    const res = await request(app).post('/api/users/register').send({
      name: 'William',
      email: 'william@test.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(400);
  });

  test('rejects weak registration password', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/users/register').send({
      name: 'William',
      email: 'william@test.com',
      password: 'weakpass',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Password must be at least 8 characters/i);
  });

  test('locks out after repeated failed logins', async () => {
    User.findOne.mockResolvedValue({
      id: 'u1',
      email: 'william@test.com',
      password: 'hashed',
      role: 'volunteer',
      status: 'active',
      contactInfo: {},
    });

    bcrypt.compare.mockResolvedValue(false);

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/users/login').send({
        email: 'william@test.com',
        password: 'WrongPass123!',
      });
    }

    const blocked = await request(app).post('/api/users/login').send({
      email: 'william@test.com',
      password: 'WrongPass123!',
    });

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Too many failed login attempts/i);
  });

  test('does not reveal account status when the password is wrong', async () => {
    User.findOne.mockResolvedValue({
      id: 'u2',
      email: 'inactive@test.com',
      password: 'hashed',
      role: 'volunteer',
      status: 'suspended',
      contactInfo: {},
    });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app).post('/api/users/login').send({
      email: 'inactive@test.com',
      password: 'WrongPass123!',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid credentials');
  });

  test('admin can update user role', async () => {
    const userDoc = {
      id: 'u1',
      name: 'User',
      email: 'u@test.com',
      role: 'volunteer',
      status: 'active',
      save: jest.fn().mockResolvedValue(true),
    };
    User.findById.mockResolvedValue(userDoc);

    const res = await request(app)
      .put('/api/users/u1')
      .set('x-test-role', 'admin')
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  test('rejects an invalid role', async () => {
    const res = await request(app)
      .put('/api/users/u1')
      .set('x-test-role', 'admin')
      .send({ role: 'superuser' });

    expect(res.status).toBe(400);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('admins cannot demote, deactivate, or delete themselves', async () => {
    const demote = await request(app).put('/api/users/admin-1').send({ role: 'volunteer' });
    expect(demote.status).toBe(400);

    const suspend = await request(app).put('/api/users/admin-1').send({ status: 'suspended' });
    expect(suspend.status).toBe(400);

    const remove = await request(app).delete('/api/users/admin-1');
    expect(remove.status).toBe(400);
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('returns 400 with the validation message when registration data is invalid', async () => {
    User.findOne.mockResolvedValue(null);
    mockSaveError = Object.assign(new Error('validation'), {
      name: 'ValidationError',
      errors: { email: { message: 'Please provide a valid email address' } },
    });

    try {
      const res = await request(app)
        .post('/api/users/register')
        .send({ name: 'A', email: 'bad', password: 'Strong123!' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Please provide a valid email address');
    } finally {
      mockSaveError = null;
    }
  });
});
