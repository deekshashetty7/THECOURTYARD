# Email Verification System Setup Guide

## Overview
This guide explains how to set up the email verification system using Gmail SMTP with an App Password.

## Requirements
- Gmail account (the admin email that will send verification emails)
- Node.js environment with required dependencies

## Step 1: Generate Gmail App Password

1. **Enable 2-Step Verification**
   - Go to https://myaccount.google.com/
   - Click "Security" in the left sidebar
   - Enable 2-Step Verification (if not already enabled)

2. **Create App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your platform)
   - Google will generate a 16-character app password
   - Copy this password (without spaces)

## Step 2: Environment Configuration

Add the following variables to your `.env` file:

```env
# Gmail SMTP Configuration
GMAIL_ADMIN_EMAIL=hecourtyardofficial@gmail.com
GMAIL_APP_PASSWORD=iiwy mfcu qhjo ipaa

# Email Verification Settings
EMAIL_VERIFICATION_EXPIRY_MINUTES=15

# Client URL (for email verification links)
CLIENT_ORIGIN=http://localhost:5173
```

### Environment Variables Explained:
- `GMAIL_ADMIN_EMAIL`: The Gmail account email that sends verification emails
- `GMAIL_APP_PASSWORD`: The 16-character app password generated above
- `EMAIL_VERIFICATION_EXPIRY_MINUTES`: How long verification links are valid (default: 15 minutes)
- `CLIENT_ORIGIN`: Frontend URL for building verification links

## Step 3: Backend Dependencies

Ensure `nodemailer` is installed:
```bash
npm install nodemailer
```

## Step 4: Email Verification Flow

### User Signup Flow:
1. User fills signup form with: name, email, password
2. Frontend sends POST request to `/api/auth/verify-email-send`
3. Backend:
   - Generates JWT verification token (with 15-minute expiry)
   - Stores token in `email_verifications` Firestore collection
   - Sends email with verification link to user
4. User receives email and clicks verification link
5. Frontend redirects to `/verify-email?token=<token>`
6. User's browser sends POST to `/api/auth/verify-email-confirm`
7. Backend:
   - Validates JWT token
   - Checks token expiry
   - Marks email as verified in database
   - Updates user's `emailVerified` field to `true`

### Login Flow:
1. User attempts to login with credentials
2. Backend checks user's `emailVerified` field
3. If `emailVerified` is false, return error: "Please verify your email first"
4. If true, proceed with normal login

## Step 5: API Endpoints

### Send Verification Email
```
POST /api/auth/verify-email-send
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe"
}

Response:
{
  "message": "Verification email sent successfully",
  "email": "user@example.com"
}
```

### Confirm Email Verification
```
POST /api/auth/verify-email-confirm
Content-Type: application/json

{
  "token": "<JWT_TOKEN>"
}

Response:
{
  "message": "Email verified successfully",
  "verified": true,
  "email": "user@example.com"
}
```

### Check Email Verification Status
```
GET /api/auth/verify-email-check?email=user@example.com

Response:
{
  "verified": true|false,
  "exists": true|false,
  "expiryTime": "2024-04-24T12:30:00Z"
}
```

## Step 6: Frontend Integration

### Signup Page
- Located at `/signup`
- User enters: name, email, password, confirm password
- On submit, sends verification email and shows confirmation message
- User directed to check email

### Verify Email Page
- Located at `/verify-email?token=<token>`
- Automatically verifies email when token is provided
- Shows success message and redirects to login
- Shows error if token is invalid/expired

## Security Considerations

1. **Token Security**
   - Tokens are JWT-based with cryptographic signatures
   - Each token is unique and bound to the user's email
   - Tokens expire automatically after 15 minutes
   - Expired tokens cannot be reused

2. **Password Security**
   - App password is only used in backend environment variables
   - Never exposed in frontend code or API responses
   - Different from main Gmail password (safer if compromised)

3. **Email Uniqueness**
   - Email addresses are normalized (lowercase) before storage
   - Prevents duplicate email registrations

4. **Database Security**
   - Verification tokens stored in separate Firestore collection
   - User verification status tracked in `emailVerified` field
   - Verified timestamp stored for audit purposes

## Testing

### Test Email Verification:
1. Navigate to http://localhost:5173/signup
2. Fill in form and submit
3. Check browser console or terminal for verification link
4. Copy the token from the link
5. Navigate to http://localhost:5173/verify-email?token=<token>
6. Should show success message
7. User can now login

### Test Invalid Token:
1. Try using expired or malformed token
2. Should show error message
3. User can request new verification email from signup page

## Troubleshooting

### "Email service is not configured"
- Check that `GMAIL_ADMIN_EMAIL` and `GMAIL_APP_PASSWORD` are set in `.env`
- Restart server after adding env variables

### "Failed to send verification email"
- Verify Gmail credentials are correct
- Check if "Less secure app access" is needed (though app password should work)
- Check server logs for detailed error message
- Ensure internet connection is active

### Token expiration issues
- Default expiry is 15 minutes
- Can be changed via `EMAIL_VERIFICATION_EXPIRY_MINUTES` env variable
- User can request new token from signup page

### Email not received
- Check spam/junk folder
- Verify recipient email address is correct
- Check server logs for send confirmation
- Gmail may rate-limit very frequent sends (try waiting a minute)

## Database Schema

### email_verifications collection:
```json
{
  "email": "user@example.com",
  "token": "eyJhbGc...",
  "expiryTime": "2024-04-24T12:30:00Z",
  "createdAt": "2024-04-24T12:15:00Z",
  "verified": false,
  "verifiedAt": null
}
```

### users collection (additional field):
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "emailVerified": true,
  "emailVerifiedAt": "2024-04-24T12:20:00Z",
  "createdAt": "2024-04-24T12:15:00Z"
}
```

## Next Steps

1. Update login page to prevent unverified users from logging in
2. Add "resend verification email" option
3. Add email change functionality
4. Implement email verification notifications
5. Add admin dashboard to view verification statistics
