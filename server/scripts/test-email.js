require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { initializeEmailService, finalizeEmailService, verifyEmailService, getEmailProvider, sendOTPEmail } = require('../src/emailService');

async function main() {
  const to = process.argv[2] || process.env.GMAIL_ADMIN_EMAIL;
  if (!to) {
    console.error('Usage: node scripts/test-email.js recipient@email.com');
    process.exit(1);
  }

  initializeEmailService();
  await finalizeEmailService();
  const status = await verifyEmailService();
  console.log('Provider:', getEmailProvider());
  console.log('Verify:', status);

  if (!status.ok && getEmailProvider() !== 'resend') {
    console.warn('\nEmail verify failed, attempting send anyway...');
  }

  await sendOTPEmail(to, '123456', 'Test User');
  console.log(`\nOTP test email sent to ${to}`);
}

main().catch((error) => {
  console.error('\nFAILED:', error.message);
  process.exit(1);
});
