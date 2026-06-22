# OTP Registration Guide

This guide explains the new OTP verification flow for user registration with both email and phone verification.

## Overview

The registration process now requires verification through both email and SMS OTPs:
1. User initiates registration with name, email, phone, and password
2. Email OTP is automatically sent
3. User verifies email OTP
4. Phone OTP is sent
5. User verifies phone OTP
6. Registration is completed and user is logged in

## Database Tables

### `otp_tokens`
Stores OTP tokens for email and phone verification.

**Fields:**
- `id` (UUID) - Primary key
- `email` - Email address for email OTPs
- `phone` - Phone number for phone OTPs
- `otp_code` - 6-digit OTP code
- `otp_type` - ENUM('email', 'phone')
- `is_verified` - Whether OTP has been verified
- `verification_attempts` - Number of verification attempts
- `max_attempts` - Maximum allowed verification attempts (default: 5)
- `expiry_time` - When the OTP expires (default: 10 minutes from creation)
- `verified_at` - Timestamp when verified
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### `registration_pending`
Stores pending registrations waiting for OTP verification.

**Fields:**
- `id` (UUID) - Primary key
- `name` - User's full name
- `email` - User's email
- `phone` - User's phone number
- `password_hash` - Hashed password
- `email_otp_verified` - Whether email OTP is verified
- `phone_otp_verified` - Whether phone OTP is verified
- `email_otp_id` - Reference to email OTP token
- `phone_otp_id` - Reference to phone OTP token
- `created_at` - Creation timestamp
- `expires_at` - When the registration expires (30 minutes from creation)

## API Endpoints

### 1. Start Registration (`POST /api/auth/register-start`)

Initiates the registration process and sends email OTP.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+91 98765 43210",
  "password": "SecurePass123"
}
```

**Response (201):**
```json
{
  "message": "Registration started. OTP sent to your email.",
  "registrationId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "phone": "+91 98765 43210",
  "otpSentTo": "email",
  "expiresAt": "2026-06-16T10:30:00.000Z"
}
```

**Errors:**
- 400: Missing required fields or invalid format
- 409: Email already registered

---

### 2. Verify Email OTP (`POST /api/auth/verify-email-otp`)

Verifies the OTP sent to email and triggers phone OTP sending.

**Request:**
```json
{
  "registrationId": "550e8400-e29b-41d4-a716-446655440000",
  "otpCode": "123456"
}
```

**Response (200):**
```json
{
  "message": "Email OTP verified successfully. Phone OTP has been sent.",
  "registrationId": "550e8400-e29b-41d4-a716-446655440000",
  "otpSentTo": "phone",
  "phoneOTP": "654321"
}
```

**Errors:**
- 400: Invalid OTP or registration not found
- 401: OTP expired or incorrect code
- 429: Maximum OTP verification attempts exceeded

---

### 3. Verify Phone OTP (`POST /api/auth/verify-phone-otp`)

Verifies the phone OTP and completes registration.

**Request:**
```json
{
  "registrationId": "550e8400-e29b-41d4-a716-446655440000",
  "otpCode": "654321"
}
```

**Response (201):**
```json
{
  "message": "Registration completed successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+91 98765 43210",
    "role": "user",
    "emailVerified": true
  }
}
```

**Errors:**
- 400: Invalid OTP or registration not found
- 401: OTP expired or incorrect code
- 429: Maximum OTP verification attempts exceeded

---

### 4. Resend Email OTP (`POST /api/auth/resend-email-otp`)

Resends the OTP to email if the first one was missed or expired.

**Request:**
```json
{
  "registrationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**
```json
{
  "message": "Email OTP resent successfully",
  "registrationId": "550e8400-e29b-41d4-a716-446655440000",
  "otpSentTo": "email"
}
```

---

### 5. Resend Phone OTP (`POST /api/auth/resend-phone-otp`)

Resends the OTP to phone if the first one was missed or expired.

**Request:**
```json
{
  "registrationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**
```json
{
  "message": "Phone OTP resent successfully",
  "registrationId": "550e8400-e29b-41d4-a716-446655440000",
  "otpSentTo": "phone",
  "phoneOTP": "654321"
}
```

---

## Configuration

Add these environment variables to your `.env` file:

```env
# OTP Configuration
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5

# Email Configuration (required for sending OTPs)
GMAIL_ADMIN_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# SMS Configuration (optional, for future SMS OTP support)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

## Frontend Integration Example

```javascript
// Step 1: Start registration
const registerStartResponse = await fetch('/api/auth/register-start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+91 98765 43210',
    password: 'SecurePass123'
  })
});

const startData = await registerStartResponse.json();
const registrationId = startData.registrationId;

// Step 2: Get email OTP from user and verify
const emailOTPResponse = await fetch('/api/auth/verify-email-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    registrationId: registrationId,
    otpCode: userEnteredEmailOTP
  })
});

const emailOTPData = await emailOTPResponse.json();

// Step 3: Get phone OTP from user and verify
const phoneOTPResponse = await fetch('/api/auth/verify-phone-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    registrationId: registrationId,
    otpCode: userEnteredPhoneOTP
  })
});

const phoneOTPData = await phoneOTPResponse.json();

// User is now logged in with accessToken and refreshToken
localStorage.setItem('accessToken', phoneOTPData.accessToken);
navigate('/user/home');
```

## Testing

### Using Test OTPs

During testing, phone OTPs are included in API responses:

```json
{
  "phoneOTP": "654321"  // Use this for testing
}
```

For email OTPs, check the server logs or your Gmail inbox for the sent OTP.

### Test Credentials

```bash
curl -X POST http://localhost:3000/api/auth/register-start \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+91 98765 43210",
    "password": "TestPass123"
  }'
```

## Security Considerations

1. **OTP Expiry**: OTPs expire after 10 minutes (configurable)
2. **Max Attempts**: Users get 5 attempts to enter correct OTP (configurable)
3. **Registration Expiry**: Pending registrations expire after 30 minutes
4. **Rate Limiting**: Consider implementing rate limiting for OTP generation
5. **Secure Passwords**: Passwords are hashed with bcryptjs (10 rounds)

## Backward Compatibility

The original `/api/auth/register` endpoint still works for direct registration without OTP verification. Use the new endpoints for enhanced security.

## Future Enhancements

1. SMS OTP delivery via Twilio
2. Biometric verification
3. Two-factor authentication
4. OTP resend limits
5. Email verification codes instead of OTPs
