const dotenv = require('dotenv');

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || 'replace-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtCookieName: process.env.JWT_COOKIE_NAME || 'tcy_token',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mysqlUrl: process.env.MYSQL_URL || '',
  mysqlHost: process.env.MYSQL_HOST || '',
  mysqlPort: Number(process.env.MYSQL_PORT || 3306),
  mysqlUser: process.env.MYSQL_USER || '',
  mysqlPassword: process.env.MYSQL_PASSWORD || '',
  mysqlDatabase: process.env.MYSQL_DATABASE || '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'courtyard/gallery',
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL || '',
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD || '',
  adminSeedName: process.env.ADMIN_SEED_NAME || 'Platform Admin',
  gmailAdminEmail: String(process.env.GMAIL_ADMIN_EMAIL || '').trim(),
  gmailAppPassword: String(process.env.GMAIL_APP_PASSWORD || '').trim(),
  resendApiKey: String(process.env.RESEND_API_KEY || '').trim(),
  brevoApiKey: String(process.env.BREVO_API_KEY || '').trim(),
  emailFrom: String(process.env.EMAIL_FROM || '').trim(),
  emailProviderOrder: String(process.env.EMAIL_PROVIDER_ORDER || 'brevo,smtp,gmail').trim(),
  smtpHost: String(process.env.SMTP_HOST || '').trim(),
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: String(process.env.SMTP_USER || '').trim(),
  smtpPass: String(process.env.SMTP_PASS || '').trim(),
  emailVerificationExpiryMinutes: Number(process.env.EMAIL_VERIFICATION_EXPIRY_MINUTES || 15),
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 15),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  twilio_account_sid: process.env.TWILIO_ACCOUNT_SID || '',
  twilio_auth_token: process.env.TWILIO_AUTH_TOKEN || '',
  twilio_phone_number: process.env.TWILIO_PHONE_NUMBER || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};

async function connectDatabase() {
  const hasMysqlDatabase = Boolean(env.mysqlUrl || (env.mysqlHost && env.mysqlUser && env.mysqlDatabase));

  if (!hasMysqlDatabase) {
    throw new Error('MySQL credentials are required: MYSQL_URL or MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE');
  }

  return { mode: 'mysql' };
}

function isProduction() {
  return env.nodeEnv === 'production';
}

module.exports = {
  env,
  connectDatabase,
  isProduction,
};
