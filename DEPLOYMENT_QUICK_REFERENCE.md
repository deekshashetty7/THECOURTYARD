# 🚀 Quick Deployment Reference Card

## 1️⃣ Backend Deployment (Render)

### Create Service
1. https://render.com → **New +** → **Web Service**
2. Connect GitHub repo → Select `cortyard`
3. Configure:
   - **Name**: `thecourtyard-api`
   - **Runtime**: Node
   - **Build**: `npm install`
   - **Start**: `npm start`
   - **Root**: `server`

### Environment Variables (Copy all to Render dashboard)
```
NODE_ENV=production
PORT=3000
FIREBASE_PROJECT_ID=<from Firebase>
FIREBASE_PRIVATE_KEY=<from Firebase service account>
FIREBASE_CLIENT_EMAIL=<from Firebase service account>
FIREBASE_STORAGE_BUCKET=<from Firebase>
JWT_SECRET=<generate: openssl rand -base64 32>
GMAIL_ADMIN_EMAIL=<your gmail>
GMAIL_APP_PASSWORD=<from https://myaccount.google.com/apppasswords>
CLIENT_ORIGIN=https://thecourtyard.vercel.app
SUPABASE_URL=<from Supabase>
SUPABASE_KEY=<from Supabase>
CLOUDINARY_NAME=<from Cloudinary>
CLOUDINARY_API_KEY=<from Cloudinary>
CLOUDINARY_API_SECRET=<from Cloudinary>
```

### Result
- API runs at: `https://thecourtyard-api.onrender.com`
- Health check: `curl https://thecourtyard-api.onrender.com/api/health`

---

## 2️⃣ Frontend Deployment (Vercel)

### Create Project
1. https://vercel.com → **Add New** → **Project**
2. Import GitHub repo → Select `cortyard`
3. Configure:
   - **Framework**: Vite
   - **Build**: `npm run build`
   - **Output**: `dist`

### Environment Variables (Copy all to Vercel dashboard)
```
VITE_FIREBASE_API_KEY=<from Firebase console>
VITE_FIREBASE_AUTH_DOMAIN=<your_project.firebaseapp.com>
VITE_FIREBASE_PROJECT_ID=<from Firebase>
VITE_FIREBASE_STORAGE_BUCKET=<your_bucket.appspot.com>
VITE_FIREBASE_MESSAGING_SENDER_ID=<from Firebase>
VITE_FIREBASE_APP_ID=<from Firebase>
VITE_API_BASE_URL=https://thecourtyard-api.onrender.com/api
```

### Result
- Frontend runs at: `https://thecourtyard.vercel.app`
- Automatically deployed on `git push`

---

## 🔐 Getting Credentials

### Firebase Service Account
```
Firebase Console → Settings → Service Accounts 
→ Generate new private key → Download JSON
→ Copy: project_id, private_key, client_email
```

### Gmail App Password
```
1. https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Copy 16-character password
```

### JWT Secret
```bash
openssl rand -base64 32
```

### Supabase Keys
```
Supabase Dashboard → Settings → API
→ Copy: Project URL, Anon public key
```

### Cloudinary Keys
```
Cloudinary Dashboard → Settings → API Keys
→ Copy: Cloud Name, API Key, API Secret
```

---

## ✅ Post-Deployment Tests

1. **Backend Health**: `curl https://thecourtyard-api.onrender.com/api/health`
2. **Frontend Loading**: Visit `https://thecourtyard.vercel.app`
3. **Sign Up**: Test user registration with Gmail
4. **Email Verification**: Check inbox for verification email
5. **Login**: Test login with verified account
6. **Dashboard**: Verify access to user dashboard

---

## 🔄 Deployment Workflow

```bash
# Local development changes
git add .
git commit -m "Description of changes"
git push origin main

# Automatic deployment triggered:
# → Render: Rebuilds and deploys backend
# → Vercel: Rebuilds and deploys frontend
```

---

## 📊 Monitor Deployments

**Render Dashboard**:
- Service → Activity → View logs
- Settings → Environment → Update variables
- Redeploy on env changes

**Vercel Dashboard**:
- Deployments → View build logs
- Settings → Environment Variables
- Automatic redeploy on push

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Check env vars in Render, verify Firebase credentials |
| Frontend blank page | Check browser console, verify VITE_API_BASE_URL |
| API requests fail | Check CORS, verify CLIENT_ORIGIN matches Vercel URL |
| Email not sending | Check Gmail password, verify admin email |
| Build timeout | Increase timeout in platform settings or optimize build |

---

## 📞 Useful Links

- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Firebase Console](https://console.firebase.google.com)
- [GitHub](https://github.com)
