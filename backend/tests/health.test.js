const request = require('supertest');
const { app, validateRuntimeConfig } = require('../server');

describe('health + runtime hardening', () => {
  test('returns health payload and request id', async () => {
    const res = await request(app).get('/api/health');

    // No database in unit tests, so health reports degraded with a 503.
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.service).toBe('forHumanity-backend');
    expect(res.body.db).toBe('disconnected');
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

  test('requires metrics token when METRICS_TOKEN is set', async () => {
    process.env.METRICS_TOKEN = 'metrics-secret';
    try {
      const denied = await request(app).get('/api/metrics');
      expect(denied.status).toBe(401);

      const allowed = await request(app)
        .get('/api/metrics')
        .set('x-metrics-token', 'metrics-secret');
      expect(allowed.status).toBe(200);
    } finally {
      delete process.env.METRICS_TOKEN;
    }
  });

  test('disables metrics in production when no token is configured', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(404);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test('groups unmatched paths in route metrics', async () => {
    await request(app).get('/api/does-not-exist-123');
    const res = await request(app).get('/api/metrics');
    expect(res.body.requests.byRoute.unmatched).toBeGreaterThan(0);
    expect(res.body.requests.byRoute['/api/does-not-exist-123']).toBeUndefined();
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
