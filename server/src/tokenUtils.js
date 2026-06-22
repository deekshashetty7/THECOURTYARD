const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('./config');

/**
 * Generate a secure verification token using UUID
 * Returns both the token and its hash for storage
 */
function generateVerificationToken() {
  const token = crypto.randomUUID();
  return token;
}

/**
 * Generate a JWT verification token
 * Includes email in the payload for additional verification
 */
function generateJWTVerificationToken(email) {
  const token = jwt.sign(
    { email, type: 'email_verification' },
    env.jwtSecret,
    { expiresIn: `${env.emailVerificationExpiryMinutes}m` }
  );
  return token;
}

/**
 * Generate JWT auth token (access token)
 * Used for user authentication and authorization
 */
function generateAuthToken(userId, email, name, role = 'user', emailVerified = false) {
  const token = jwt.sign(
    {
      sub: userId,
      email,
      name,
      role,
      emailVerified,
      type: 'auth',
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn || '7d' }
  );
  return token;
}

/**
 * Generate JWT refresh token
 * Used to refresh access tokens without requiring login
 */
function generateRefreshToken(userId) {
  const token = jwt.sign(
    {
      sub: userId,
      type: 'refresh',
    },
    env.jwtSecret,
    { expiresIn: '30d' }
  );
  return token;
}

/**
 * Verify JWT token
 */
function verifyJWTToken(token) {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (decoded.type !== 'email_verification') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Verify auth token
 */
function verifyAuthToken(token) {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (decoded.type !== 'auth') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

function generatePasswordResetToken(email) {
  return jwt.sign(
    { email, type: 'password_reset' },
    env.jwtSecret,
    { expiresIn: `${env.emailVerificationExpiryMinutes}m` }
  );
}

function verifyPasswordResetToken(token) {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Calculate token expiry time
 */
function getTokenExpiryTime() {
  const expiryMs = env.emailVerificationExpiryMinutes * 60 * 1000;
  return new Date(Date.now() + expiryMs);
}

/**
 * Check if token is expired
 */
function isTokenExpired(expiryTime) {
  return new Date() > new Date(expiryTime);
}

module.exports = {
  generateVerificationToken,
  generateJWTVerificationToken,
  generateAuthToken,
  generateRefreshToken,
  verifyJWTToken,
  verifyAuthToken,
  verifyRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  getTokenExpiryTime,
  isTokenExpired,
};
