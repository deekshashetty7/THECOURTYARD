# Deployment Guide: Render & Vercel

This guide provides step-by-step instructions for deploying **thecourtyard** to Render (backend) and Vercel (frontend).

---

## 📋 Prerequisites

- GitHub account with repository access
- Render account (https://render.com)
- Vercel account (https://vercel.com)
- Firebase credentials (already configured)
- Gmail App Password for email verification
- Supabase credentials (optional)
- Cloudinary credentials (optional)

---

## 🚀 Backend Deployment (Render)

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Setup deployment configuration"
git push origin main
```

### Step 2: Connect Render to GitHub
1. Go to https://render.com/dashboard
2. Click **"New +"** → **"Web Service"**
3. Select **"Build and deploy from a Git repository"**
4. Connect your GitHub account and authorize Render
5. Select the **cortyard** repository

### Step 3: Configure Render Service
**Basic Settings:**
- **Name**: `thecourtyard-api`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Root Directory**: `server`

### Step 4: Add Environment Variables
In Render dashboard, go to Environment:

```
NODE_ENV=production
PORT=3000
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_STORAGE_BUCKET=your_bucket
JWT_SECRET=your_jwt_secret_min_32_chars
GMAIL_ADMIN_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
CLIENT_ORIGIN=https://thecourtyard.vercel.app
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**How to get each credential:**

- **Firebase Credentials**: Download from Firebase Console → Project Settings → Service Accounts
- **Gmail App Password**: 
  1. Enable 2FA on Gmail account
  2. Go to https://myaccount.google.com/apppasswords
  3. Generate new app password (select Mail + Windows Computer)
- **JWT_SECRET**: Generate random string: `openssl rand -base64 32`
- **Supabase**: Get from Supabase project settings
- **Cloudinary**: Get from Cloudinary dashboard

### Step 5: Deploy
1. Click **"Create Web Service"**
2. Render will automatically build and deploy
3. Your backend URL will be: `https://thecourtyard-api.onrender.com`

### Step 6: Verify Deployment
```bash
curl https://thecourtyard-api.onrender.com/api/health
```
Should return: `{"status":"ok"}`

---

## 🌐 Frontend Deployment (Vercel)

### Step 1: Connect Vercel to GitHub
1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Select **"Import Git Repository"**
4. Paste your GitHub repo URL or select from list
5. Click **"Import"**

### Step 2: Configure Project Settings
**Build & Development:**
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Add Environment Variables
In Vercel → Settings → Environment Variables, add:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=https://thecourtyard-api.onrender.com/api
```

**How to get Firebase frontend credentials:**
1. Firebase Console → Project Settings
2. Copy values from the "Web apps" section
3. These are different from the backend service account keys

### Step 4: Deploy
1. Click **"Deploy"**
2. Vercel will automatically build and deploy
3. Your frontend URL will be: `https://thecourtyard.vercel.app`

### Step 5: Configure Custom Domain (Optional)
1. Go to Vercel Project Settings → Domains
2. Add your custom domain
3. Update DNS records as shown by Vercel

---

## ✅ Post-Deployment Checklist

- [ ] Backend health check passes: `/api/health`
- [ ] Frontend loads without errors
- [ ] Login/Signup pages work
- [ ] Email verification emails are sent
- [ ] Database connections work
- [ ] File uploads to Cloudinary work
- [ ] Environment variables are not exposed in logs

---

## 🔧 Troubleshooting

### Backend fails to start
- Check logs in Render dashboard
- Verify all environment variables are set
- Ensure Node.js version compatibility

### Frontend builds but shows blank page
- Check browser console for errors
- Verify `VITE_API_BASE_URL` is correctly set
- Clear browser cache and rebuild

### API requests fail from frontend
- Check CORS settings in backend (should accept Vercel domain)
- Verify `CLIENT_ORIGIN` environment variable on backend
- Check browser Network tab for 403 Forbidden errors

### Email verification not working
- Verify Gmail app password is correct
- Check email logs in backend
- Ensure `GMAIL_ADMIN_EMAIL` matches the Gmail account

---

## 📱 Useful Commands

**View backend logs:**
```bash
# In Render dashboard, click on your service and go to Logs tab
```

**View frontend build logs:**
```bash
# In Vercel dashboard, click Deployments and view build details
```

**Update environment variables:**
1. Make changes in platform dashboard
2. Redeploy the service
3. Most changes take effect immediately; some require restart

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** - use `.gitignore`
2. **Rotate JWT_SECRET** regularly in production
3. **Use strong Gmail app passwords** - save them securely
4. **Enable HTTPS** - both platforms do this by default
5. **Set up monitoring** - configure alerts for errors
6. **Regular backups** - export Firestore data periodically
7. **CORS protection** - restrict API to known domains only

---

## 📞 Support

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Firebase Docs**: https://firebase.google.com/docs
- **Email**: Support via platform dashboards

---

## 🎯 Next Steps

After deployment:
1. Test all user flows (signup, login, booking)
2. Monitor error logs for the first 24 hours
3. Set up automated backups
4. Configure monitoring/alerts
5. Plan maintenance windows
