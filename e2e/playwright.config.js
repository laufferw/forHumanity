// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const BACKEND_PORT = 5055;
const FRONTEND_PORT = 3055;

// Shared with global-setup.js, which resets this database before the run.
process.env.E2E_MONGODB_URI =
  process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/forHumanity-e2e';
process.env.E2E_API_URL = `http://localhost:${BACKEND_PORT}/api`;

/**
 * Runs the real backend against a dedicated MongoDB database and serves the
 * production frontend build. Build the frontend first with
 * REACT_APP_API_URL=http://localhost:5055/api (see README).
 */
module.exports = defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Downtown Denver; tests override it where location matters.
    geolocation: { latitude: 39.7392, longitude: -104.9903 },
    permissions: ['geolocation'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node server.js',
      cwd: path.join(__dirname, '../backend'),
      url: `${process.env.E2E_API_URL}/health`,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        PORT: String(BACKEND_PORT),
        MONGODB_URI: process.env.E2E_MONGODB_URI,
        JWT_SECRET: 'e2e-secret',
        CLIENT_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
        // Submission limits are covered by unit tests; keep them out of the way here.
        REQUEST_RATE_LIMIT_MAX: '1000',
        RATE_LIMIT_MAX: '10000',
      },
    },
    {
      command: `npx serve -s ../frontend/build -l ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
    },
  ],
});
