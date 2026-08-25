# TCY Platform - Professional Authentication Guide

## Overview
The TCY platform features two separate authentication portals: **User Portal** and **Admin Portal**. Each has distinct login flows, features, and access levels.

---

## 🔐 User Portal

### Entry Points
- **Homepage CTA**: Click "Login" button on landing page → `/user/login`
- **Direct URL**: `https://yourdomain.com/user/login`

### User Login Flow

#### 1. Login Page (`/user/login`)
**Features:**
- Email/Password authentication
- Google OAuth integration (one-click sign-in)
- Email verification (if enabled)
- Forgot password link
- New account registration link

**Fields Required:**
```
• Email (required, format: user@example.com)
• Password (required)
```

**Success Action:** Redirects to `/user/home`

#### 2. Registration (`/user/register`)
**New users create account with:**
```
• Full Name
• Email
• Password (6+ characters recommended)
• Phone Number (optional)
```

**After Registration:**
- Confirmation email sent (if email verification enabled)
- Verify email → allows login access
- Auto-login available or manual login required

#### 3. Password Recovery Flow
**If you forget your password:**

**Step 1:** Click "Forgot Password?" on login page
- Route: `/user/forgot-password`
- Enter registered email address
- Receive password reset link within 5 minutes

**Step 2:** Check your email
- Click reset link (valid for 24 hours)
- Auto-routes to `/user/reset-password`

**Step 3:** Set new password
- Enter new password
- Confirm password (must match)
- Password updated successfully
- Redirect to login with updated password

---

### User Portal Features (After Login)

#### Home (`/user/home`)
- Dashboard with upcoming bookings
- Quick access to booking system
- Subscription status

#### Booking (`/user/booking`)
- Browse available courts
- Select date/time
- Choose booking duration
- View pricing

#### Payment (`/user/payment`)
- Process secure payment
- Multiple payment methods
- Invoice/receipt generation

#### Subscriptions (`/user/subscription`)
- View subscription plans
- Upgrade/downgrade plans
- Manage billing

#### Profile (`/user/profile`)
- View account information
- Booking history
- Subscription details
- Logout option

#### Logout
Located in profile page dropdown menu.

---

## 👨‍💼 Admin Portal

### Entry Points
- **Admin Dashboard Link**: Accessible only to admin-role accounts
- **Direct URL**: `https://yourdomain.com/admin/login`
- **From Homepage**: Not directly visible; use direct URL

### Admin Login Flow

#### 1. Login Page (`/admin/login`)
**Features:**
- Email/Password authentication only (no OAuth)
- Admin-specific UI
- Forgot password link
- Error notifications for unauthorized accounts

**Fields Required:**
```
• Admin Email (required, format: admin@courtyard.com)
• Password (required)
```

**Authorization:**
- User account must have `role: 'admin'` in database
- Regular user emails are rejected

**Success Action:** Redirects to `/admin/dashboard`

**Security Note:** If login fails, verify:
1. Email has admin role assigned in database
2. Password is correct
3. Account is not disabled

#### 2. Password Recovery Flow
**Step 1:** Click "Forgot Password?" on admin login page
- Route: `/admin/forgot-password`
- Enter admin email address
- Receive password reset link

**Step 2:** Check email
- Click reset link (24-hour validity)
- Auto-routes to `/admin/reset-password`

**Step 3:** Set new password
- Enter new password
- Confirm password
- Login with updated credentials

---

### Admin Portal Features (After Login)

#### Dashboard (`/admin/dashboard`)
- System overview
- Key metrics (bookings, revenue, subscriptions)
- Quick actions

#### Bookings (`/admin/bookings`)
- View all user bookings
- Create manual bookings
- Modify/cancel bookings
- Generate reports

#### Settings (`/admin/settings`)
**Sub-sections:**
- **Court Information**: Pricing, facilities, description
- **Gallery Manager** (`/admin/settings/gallery`):
  - Upload court images (file upload, not URLs)
  - Edit image captions
  - Delete images
  - Changes appear on homepage carousel

#### Logout
Located in top navigation menu.

---

## 🔄 Authentication Methods Comparison

| Feature | User | Admin |
|---------|------|-------|
| Email/Password | ✅ | ✅ |
| Google OAuth | ✅ | ❌ |
| Email Verification | Optional | ⚠️ |
| Password Recovery | ✅ | ✅ |
| Account Creation | Self-service | Manual (database) |
| Role Assignment | User | Admin |
| Default Redirect | `/user/home` | `/admin/dashboard` |

---

## 🎯 Professional Usage Scenarios

### Scenario 1: New Platform User
1. Navigate to homepage
2. Click "Login" button
3. Click "Create New Account"
4. Register with email/password
5. Verify email (check inbox)
6. Return to login
7. Enter credentials
8. Access booking portal

**Time to first booking:** ~5 minutes

---

### Scenario 2: Returning User
1. Navigate to homepage
2. Click "Login" button
3. Enter email & password
4. One-click access to bookings
5. Make new booking

---

### Scenario 3: Admin Managing Bookings
1. Navigate to `/admin/login`
2. Enter admin credentials
3. Go to Admin Dashboard
4. Click "Bookings" → View all reservations
5. Filter by date/court/user
6. Create/modify/cancel as needed

---

### Scenario 4: Admin Updating Gallery
1. Go to Admin Settings
2. Click "Open gallery manager"
3. Upload court images (JPG/PNG)
4. Add captions (optional)
5. Save changes
6. Images appear on homepage carousel (3.5s auto-rotate)

---

### Scenario 5: Forgotten Password Recovery

#### User Flow:
```
Login Page (can't remember password)
    ↓
Click "Forgot Password?"
    ↓
Enter registered email
    ↓
Check email for reset link
    ↓
Click reset link → New password form
    ↓
Enter new password + confirm
    ↓
Login with updated password
    ↓
Full access restored
```

#### Admin Flow:
Same as above, just use `/admin/forgot-password`

---

## 🛡️ Security Best Practices

### For Users:
1. ✅ **Use strong passwords** (8+ characters, mix upper/lower case, numbers, symbols)
2. ✅ **Never share your password** with anyone
3. ✅ **Verify email address** if prompted (adds security layer)
4. ✅ **Logout** when using shared computers
5. ✅ **Use email recovery** if password forgotten (never reset via email provider)
6. ✅ **Keep email account secure** (it's your recovery method)

### For Admins:
1. ✅ **Change default password** immediately
2. ✅ **Use unique, complex password** (12+ characters recommended)
3. ✅ **Never share admin credentials** with users
4. ✅ **Logout after each session**
5. ✅ **Notify support** if suspicious activity detected
6. ✅ **Review booking logs** regularly

### For Platform Managers:
1. ✅ **Verify email authenticity** before admin account creation
2. ✅ **Implement IP whitelisting** for admin logins (future enhancement)
3. ✅ **Monitor failed login attempts** (rate limiting in place)
4. ✅ **Rotate admin passwords** quarterly (best practice)
5. ✅ **Keep galleries updated** with current court images
6. ✅ **Test password recovery** monthly

---

## 📧 Email Notifications

### User Emails:
- **Verification Email**: Enable email verification for accounts
- **Password Reset Link**: Valid 24 hours, contains secure code
- **Booking Confirmation**: Sent after successful reservation

### Admin Emails:
- **Password Reset Link**: Valid 24 hours, contains secure code
- **System Alerts** (future): High-priority notifications

---

## ⚠️ Troubleshooting

### "Invalid email or password"
- [ ] Verify email spelling (case-insensitive, trimmed)
- [ ] Confirm password is correct
- [ ] Check Caps Lock is off
- [ ] Wait 1 minute (rate limiting may be active)

### "Email not confirmed" (User only)
- [ ] Check spam folder for verification email
- [ ] Click "Resend verification email" link
- [ ] Wait up to 5 minutes for email
- [ ] Contact support if not received

### "Unauthorized" (Admin login)
- [ ] Confirm email has admin role in database
- [ ] Verify account isn't disabled
- [ ] Contact system administrator

### Password reset link not working
- [ ] Confirm link was copied completely
- [ ] Check link hasn't expired (24-hour window)
- [ ] Try clicking "Resend" on forgot-password page
- [ ] Check spam/promotions folder

### Google OAuth not working (User only)
- [ ] Confirm browser cookies are enabled
- [ ] Try incognito/private browsing
- [ ] Ensure Google account uses same email
- [ ] Contact support if issue persists

---

## 🔌 Integration Points

### Login Success Redirects:
```
User Login  → /user/home
Admin Login → /admin/dashboard
```

### Session Persistence:
```
Browser Local Storage
• Auth token: Supabase managed
• User role: Cached in context
• Session expires: 24 hours (auto-refresh)
```

### Logout Behavior:
```
Clear Auth Context
Clear Session Storage
Redirect to Home Page
```

---

## 📊 Account Types

### User Account
- **Created by**: User self-registration
- **Capabilities**: Book courts, manage subscriptions, view history
- **Restrictions**: No admin access
- **Default Role**: `'user'`

### Admin Account  
- **Created by**: System administrator (database)
- **Capabilities**: Full system management, booking control, settings
- **Restrictions**: Cannot book as user (separate interface)
- **Default Role**: `'admin'`

---

## 🚀 Quick Links

| Action | URL |
|--------|-----|
| Homepage | `/` |
| User Login | `/user/login` |
| User Registration | `/user/register` |
| Admin Login | `/admin/login` |
| User Home | `/user/home` |
| User Profile | `/user/profile` |
| Admin Dashboard | `/admin/dashboard` |
| Admin Settings | `/admin/settings` |
| Gallery Manager | `/admin/settings/gallery` |
| Forgot Password (User) | `/user/forgot-password` |
| Forgot Password (Admin) | `/admin/forgot-password` |

---

## 📝 Support

For issues or questions:
1. Check troubleshooting section above
2. Verify you're using correct portal (user vs admin)
3. Contact platform support with:
   - Email address
   - Error message
   - Time of incident
   - Browser/device info

---

**Last Updated:** April 16, 2026  
**Version:** 1.0
