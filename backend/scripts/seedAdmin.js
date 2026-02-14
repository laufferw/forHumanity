require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forHumanity';
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'forHumanity Admin';

  if (!email || !password) {
    console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  let user = await User.findOne({ email });
  if (!user) {
    user = new User({
      name,
      email,
      password,
      role: 'admin',
      status: 'active',
      contactInfo: {},
    });
  } else {
    user.name = name;
    user.password = password;
    user.role = 'admin';
    user.status = 'active';
  }

  await user.save();
  console.log(`Admin user ready: ${email}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
