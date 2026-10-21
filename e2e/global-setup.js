const path = require('path');
const { execFileSync } = require('child_process');

const backendDir = path.join(__dirname, '../backend');
// Use the backend's own mongoose so the e2e package doesn't need its own copy.
const mongoose = require(require.resolve('mongoose', { paths: [backendDir] }));

const ADMIN = { email: 'admin@e2e.test', password: 'Admin123!e2e', name: 'E2E Admin' };

module.exports = async () => {
  const uri = process.env.E2E_MONGODB_URI;
  if (!/e2e/.test(uri)) {
    throw new Error(`Refusing to reset a database whose name doesn't contain "e2e": ${uri}`);
  }

  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  execFileSync('node', ['scripts/seedAdmin.js'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      MONGODB_URI: uri,
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      ADMIN_NAME: ADMIN.name,
    },
  });
};

module.exports.ADMIN = ADMIN;
