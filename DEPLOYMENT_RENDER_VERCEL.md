# Deployment Guide: Render & Vercel

This guide provides step-by-step instructions for deploying **thecourtyard** to Render (backend) and Vercel (frontend).

---

## 📋 Prerequisites

- GitHub account with repository access
- Render account (https://render.com)
- Vercel account (https://vercel.com)
- MySQL database (hosted provider)
- Gmail App Password for email verification
- Cloudinary credentials (optional, for image uploads)

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
5. Select the **THECOURTYARD** repository

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
JWT_SECRET=your_jwt_secret_min_32_chars
MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=your_database_name
GMAIL_ADMIN_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
CLIENT_ORIGIN=https://courtyard-pi.vercel.app
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**How to get each credential:**

- **MySQL**: Create a database on your provider and run `server/mysql/schema.sql`
- **Gmail App Password**: 
  1. Enable 2FA on Gmail account
  2. Go to https://myaccount.google.com/apppasswords
  3. Generate new app password (select Mail + Windows Computer)
- **JWT_SECRET**: Generate random string: `openssl rand -base64 32`
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
VITE_API_BASE_URL=https://thecourtyard-api.onrender.com/api
VITE_SITE_URL=https://courtyard-pi.vercel.app
VITE_OAUTH_REDIRECT_BASE_URL=https://courtyard-pi.vercel.app
```

### Step 4: Deploy
1. Click **"Deploy"**
2. Vercel builds and deploys automatically
3. Your frontend URL will be: `https://courtyard-pi.vercel.app`

---

## 🔄 Continuous Deployment

Both platforms auto-deploy when you push to `main`:

```bash
git add .
git commit -m "Your changes"
git push origin main
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
6. **Regular backups** - export MySQL data periodically
7. **CORS protection** - restrict API to known domains only

---

## 📞 Support

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Email**: Support via platform dashboards

---

## 🎯 Next Steps

After deployment:
1. Test all user flows (signup, login, booking)
2. Monitor error logs for the first 24 hours
3. Set up automated MySQL backups
4. Configure monitoring/alerts
5. Plan maintenance windows
