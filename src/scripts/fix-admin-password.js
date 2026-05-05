/**
 * One-time script: set admin@demo.com password to bcrypt hash of admin123.
 * Run: node src/scripts/fix-admin-password.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/manufacturing_erp');
  const hash = bcrypt.hashSync('admin123', 10);
  const result = await User.updateOne(
    { email: 'admin@demo.com' },
    { $set: { password: hash } }
  );
  console.log('Result:', result);
  if (result.matchedCount === 1) {
    console.log('✅ admin@demo.com password updated. You can login with admin123');
  } else {
    console.log('⚠️ admin@demo.com not found. Run npm run seed first.');
  }
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
