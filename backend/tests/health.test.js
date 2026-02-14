const request = require('supertest');
const { app, validateRuntimeConfig } = require('../server');

describe('health + runtime hardening', () => {
  test('returns health payload and request id', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('forHumanity-backend');
    expect(['connected', 'disconnected']).toContain(res.body.db);
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  test('returns in-memory metrics payload', async () => {
    await request(app).get('/api/test');
    const res = await request(app).get('/api/metrics');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.requests.total).toBeGreaterThan(0);
    expect(res.body.requests.byRoute['/api/test']).toBeGreaterThan(0);
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
