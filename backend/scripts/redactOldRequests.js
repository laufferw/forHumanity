require('dotenv').config();
const mongoose = require('mongoose');
const { redactClosedRequests, retentionDays } = require('../services/retention');

// One-off run of the retention policy, e.g. from cron if the server's daily
// run is disabled. Usage: RETENTION_DAYS=90 npm run privacy:redact
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forHumanity');
  const count = await redactClosedRequests();
  console.log(`Redacted ${count} request(s) closed more than ${retentionDays()} days ago.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
