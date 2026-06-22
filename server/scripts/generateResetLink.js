#!/usr/bin/env node
const { env } = require('../src/config');
const { getAuth } = require('../src/firebase');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node generateResetLink.js user@example.com');
  process.exit(1);
}

(async () => {
  try {
    const authAdmin = getAuth();
    const actionCodeSettings = { url: `${env.clientOrigin || 'http://localhost:5173'}/login`, handleCodeInApp: true };
    const link = await authAdmin.generatePasswordResetLink(email, actionCodeSettings);
    console.log(link);
  } catch (err) {
    console.error('Failed to generate reset link:', err);
    process.exit(1);
  }
})();
