const request = require('supertest');
const { app, validateRuntimeConfig } = require('../server');

describe('health + runtime hardening', () => {
  test('returns health payload', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('forHumanity-backend');
    expect(['connected', 'disconnected']).toContain(res.body.db);
  });

  test('blocks weak JWT secret in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-me';

    expect(() => validateRuntimeConfig()).toThrow(
      'JWT_SECRET must be set to a strong value in production.'
    );

    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
  });
});
