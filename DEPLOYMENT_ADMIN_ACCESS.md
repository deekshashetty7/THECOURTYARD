# Post-Deployment Admin Access Guide

## 🚀 Quick Access After Deployment

### Admin Login URL
```
https://yourdomain.com/admin/login
```
Replace `yourdomain.com` with your actual deployed domain.

---

## 📝 Step-by-Step Setup

### Step 1: Deploy Your Application
Your application will be deployed at one of these:
- **Custom domain**: `https://yourcompany.com`
- **Vercel**: `https://your-project.vercel.app`
- **Netlify**: `https://your-project.netlify.app`
- **Your server**: `https://your-ip-or-domain`

### Step 2: Create Admin User in Supabase

Admin accounts are NOT created through the UI. You must create them in your **Supabase database**.

#### Option A: Using Supabase Dashboard (Recommended)

1. **Login to Supabase Console**
   - Go to https://supabase.com
   - Select your project
   - Navigate to `Authentication → Users`

2. **Create New Auth User**
   - Click "Add user"
   - Enter admin email: `admin@yourdomain.com`
   - Enter password (12+ characters, strong)
   - Click "Create user"

3. **Assign Admin Role in Database**
   - Go to SQL Editor
   - Run this query:
   ```sql
   INSERT INTO users (id, email, role, name, created_at)
   SELECT id, email, 'admin', 'Admin User', NOW()
   FROM auth.users
   WHERE email = 'admin@yourdomain.com';
   ```

4. **Verify** 
   - Check `public.users` table
   - Confirm your email has `role = 'admin'`

---

#### Option B: Using SQL Editor Directly

1. Open Supabase Console → SQL Editor
2. Create user + assign role in one go:

```sql
-- Step 1: First, create auth user (via Dashboard or this creates it)
-- (If using auth.users directly, use Dashboard instead)

-- Step 2: Add to public.users table with admin role
INSERT INTO users (id, email, role, name, created_at)
VALUES 
  (
    'unique-uuid-here',  -- Generate a UUID v4
    'admin@yourdomain.com',
    'admin',
    'Admin User',
    NOW()
  )
ON CONFLICT (email) DO UPDATE
SET role = 'admin';
```

---

### Step 3: Login to Admin Portal

1. **Navigate to Admin Login**
   ```
   https://yourdomain.com/admin/login
   ```

2. **Enter Credentials**
   ```
   Email: admin@yourdomain.com
   Password: [password you set in Supabase]
   ```

3. **Success!**
   - Redirects to `/admin/dashboard`
   - Dashboard shows bookings, revenue, metrics

---

## 🔑 First-Time Admin Setup Checklist

- [ ] Application deployed and running
- [ ] Supabase project linked to your domain
- [ ] Created auth user in Supabase
- [ ] Added user row to `public.users` table with `role = 'admin'`
- [ ] Verified admin email/role in database
- [ ] Tested login at `/admin/login`
- [ ] Changed default password (security best practice)
- [ ] Configured gallery images
- [ ] Configured court pricing/details
- [ ] Tested user registration flow

---

## 📊 Admin Dashboard Access Paths

After successful login, admin can access:

| Section | URL | Purpose |
|---------|-----|---------|
| Dashboard | `/admin/dashboard` | Overview & metrics |
| Bookings | `/admin/bookings` | Manage all reservations |
| Settings | `/admin/settings` | Court info & pricing |
| Gallery | `/admin/settings/gallery` | Court images |

---

## 🆘 Troubleshooting Admin Login

### "Invalid email or password"
```
Verify in Supabase:
1. Auth user exists (Authentication → Users)
2. Password is exactly what you set
3. Email matches exactly (case-insensitive but check for spaces)
4. Account is not disabled
```

### "Unauthorized" Error
```
User exists in auth.users but NOT admin:
1. Go to Supabase → SQL Editor
2. Run: SELECT email, role FROM users WHERE email = 'admin@yourdomain.com';
3. If no result or role ≠ 'admin', insert/update:
   INSERT INTO users (id, email, role, name, created_at)
   SELECT id, email, 'admin', 'Admin User', NOW()
   FROM auth.users
   WHERE email = 'admin@yourdomain.com'
   ON CONFLICT (email) DO UPDATE SET role = 'admin';
```

### "Page not found" at `/admin/login`
```
Verify:
1. Application is deployed and running
2. React Router includes admin routes
3. Correct domain used (not localhost)
4. No domain typos
5. DNS propagated (wait up to 24 hours for new domains)
```

### "Email verification required"
```
If email verification is enabled:
1. Check email (spam folder too)
2. Click verification link
3. Then login
```

---

## 🛡️ Security After Deployment

### Required Actions:
1. **Change Default Password**
   - After first login, change to unique strong password
   - Store securely (password manager)

2. **Create Team Admin Accounts** (if applicable)
   ```sql
   -- Add multiple admins
   INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
   VALUES ('admin2@yourdomain.com', crypt('password123', gen_salt('bf')), NOW());
   
   INSERT INTO users (id, email, role, name)
   SELECT id, email, 'admin', 'Admin Name'
   FROM auth.users
   WHERE email = 'admin2@yourdomain.com';
   ```

3. **Enable RLS (Row Level Security)** on sensitive tables
   ```sql
   ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
   ```

4. **Backup Database Regularly**
   - Use Supabase automated backups
   - Schedule weekly exports

5. **Monitor Admin Activity**
   - Log all admin actions
   - Review booking modifications
   - Track settings changes

---

## 📱 Environment Variables for Deployment

Ensure these are set in your deployment platform:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Where to Set (by Platform):

**Vercel:**
1. Project Settings → Environment Variables
2. Add keys for Production
3. Redeploy

**Netlify:**
1. Site settings → Build & Deploy → Environment
2. Add keys
3. Trigger rebuild

**Self-hosted:**
1. Create `.env.production`
2. Add keys
3. Build & deploy

---

## 🔄 Reset Admin Password

If you forget the admin password:

### Via Supabase:
1. Go to Authentication → Users
2. Find admin email
3. Click "Reset password"
4. Admin receives password reset link
5. Admin clicks link and sets new password
6. Admin logs in with new password

### Via Admin Page:
1. On login page, click "Forgot Password?"
2. Enter admin email
3. Check email for reset link
4. Set new password
5. Login with new credentials

---

## 📧 Email Configuration

For password recovery emails to work, Supabase must have email templates configured.

### Default Supabase Email:
- Sender: `noreply@supabase.io` (free tier)
- Templates: Language auto-set based on user locale

### Custom Email (Enterprise):
1. Navigate to Supabase Auth Settings
2. Configure SMTP or SendGrid
3. Customize email templates
4. Test password recovery

---

## ✅ Verify Admin Access Works

After deployment:

1. Open browser (incognito mode recommended)
2. Navigate to: `https://yourdomain.com/admin/login`
3. Enter admin email and password
4. Click "Sign In"
5. Should redirect to `/admin/dashboard`
6. Verify you see:
   - Dashboard metrics
   - System overview
   - Navigation menu (Bookings, Settings, Gallery)

**If any step fails**, check troubleshooting section above.

---

## 🚨 Initial Deployment Checklist

- [ ] Application builds without errors
- [ ] Deployed to production server/platform
- [ ] Custom domain configured (if using)
- [ ] DNS propagated
- [ ] Supabase URL & keys in environment variables
- [ ] Database migrations ran successfully
- [ ] Admin user created in Supabase
- [ ] Admin role assigned in `users` table
- [ ] Admin login tested and working
- [ ] Can access dashboard
- [ ] Can upload gallery images
- [ ] Can create/modify/delete bookings
- [ ] User registration flow tested
- [ ] Password recovery tested

---

## 🎯 Common Usage After Deployment

### First Time:
1. Login to admin
2. Go to Settings → Update court info, pricing
3. Go to Gallery → Upload court images
4. View Dashboard

### Daily:
1. Check Dashboard for new bookings
2. Review user bookings in Bookings section
3. Process payments/confirmations

### As Needed:
1. Create manual bookings (admin only)
2. Modify/cancel bookings
3. Update gallery images
4. Change pricing

---

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Router Docs**: https://reactrouter.com
- **Deployment Help**: Check your platform's docs
  - Vercel: https://vercel.com/docs
  - Netlify: https://docs.netlify.com
  - Self-hosted: Your hosting provider

---

**Ready to deploy? Follow the checklist above and access admin at `/admin/login` after deployment! 🚀**
