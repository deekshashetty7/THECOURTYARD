# Firebase Migration Guide

## Overview
Your project has been successfully migrated from Supabase to Firebase. This guide will help you set up Firebase for your personal use.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project"
3. Enter your project name (e.g., "Courtyard")
4. Choose your location (or use default)
5. Click "Create Project"
6. Wait for the project to be created

## Step 2: Set Up Authentication

1. In Firebase Console, go to "Authentication" → "Get Started"
2. Enable **Email/Password**:
   - Click "Email/Password"
   - Toggle "Enable"
   - Save
3. Enable **Google Sign-In** (optional):
   - Click "Google"
   - Toggle "Enable"
   - Select a support email
   - Save

## Step 3: Create Firestore Database

1. Go to "Firestore Database"
2. Click "Create Database"
3. Choose "Start in production mode"
4. Select your region
5. Click "Create"

## Step 4: Create Firestore Collections

### Collections to Create:
- `users`
- `bookings`
- `booking_slots`
- `subscriptions`
- `settings`

For now, just create the `settings` collection with one document:

1. In Firestore, click "Start collection"
2. Collection ID: `settings`
3. Click "Auto-ID" for the document
4. Add these fields:
   ```
   pricing: {offPeak: 500, peak: 800, subscription: 2500}
   courts: ["Court 1", "Court 2", "Court 3"]
   operatingHours: {startHour: 5, endHour: 22}
   landing: {}
   createdAt: (current timestamp)
   updatedAt: (current timestamp)
   ```

## Step 5: Get Your Firebase Credentials

### For Frontend (.env.local):

1. In Firebase Console, go to "Project Settings" (gear icon)
2. Go to "Your Apps" section
3. Click "Web" app (or create one with `</>`  icon)
4. Copy the config object
5. Fill in your `.env.local` file:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# OAuth Configuration
VITE_SITE_URL=http://localhost:5173
VITE_OAUTH_REDIRECT_BASE_URL=http://localhost:5173

# Email Verification
VITE_REQUIRE_EMAIL_VERIFICATION=false

# API Base URL (if using backend server)
VITE_API_BASE_URL=http://localhost:3000/api
```

### For Backend Server (.env):

1. In Firebase Console, go to "Project Settings"
2. Go to "Service Accounts" tab
3. Click "Generate New Private Key"
4. Copy the JSON file contents
5. Add to your server `.env`:

```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY_ID=your_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Server Configuration
PORT=5000
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
```

## Step 6: Set Up Google OAuth (Optional)

1. In Firebase Console, go to "Authentication" → "Google"
2. Make sure it's enabled
3. Add Authorized JavaScript Origins:
   - `http://localhost:5173` (development)
   - `http://localhost:3000` (backend)
   - Your production domain
4. Add Authorized Redirect URIs:
   - `http://localhost:5173/login` (development)
   - Your production URLs

## Step 7: Set Firestore Security Rules

Go to "Firestore Database" → "Rules" and update with these rules:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Bookings - user can read/write their own, admin can access all
    match /bookings/{bookingId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // Nested slots collection
      match /slots/{slotId} {
        allow read, write: if request.auth.uid == get(/databases/$(database)/documents/bookings/$(bookingId)).data.userId;
        allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      }
    }

    // Booking slots - similar rules
    match /booking_slots/{slotId} {
      allow read: if true; // Everyone can read
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Subscriptions - user can read/write their own
    match /subscriptions/{subscriptionId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Settings - everyone reads, admin writes
    match /settings/{document=**} {
      allow read: if true;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Step 8: Create Admin User

To create an admin user in Firestore:

1. Go to "Authentication" and create a new user manually, or
2. Sign up through the app, then:
3. Go to Firestore → `users` collection
4. Find your user document
5. Change the `role` field from `'user'` to `'admin'`

## Step 9: Deploy (Optional)

### Deploy Frontend to Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```

### Deploy Backend to Cloud Run:

```bash
firebase init functions
# Add your server code to functions/
firebase deploy --only functions
```

## File Changes Made

### Created Files:
- `src/app/lib/firebaseClient.ts` - Firebase client configuration
- `server/src/firebase.js` - Firebase Admin SDK setup
- `server/src/firebaseServices.js` - Firestore database operations

### Updated Files:
- `src/app/context/AuthContext.tsx` - Now uses Firebase Auth
- `src/app/context/BookingContext.tsx` - Firebase imports
- `src/app/context/LandingPageContext.tsx` - Firebase imports
- `src/app/pages/ResetPasswordPage.tsx` - Simplified for Firebase
- `src/app/pages/admin/AdminDashboard.tsx` - Updated to use Firebase
- `src/app/pages/admin/AdminSettings.tsx` - Updated to use Firebase
- `package.json` - Added Firebase, removed Supabase
- `.env.local` and `.env.example` - Updated with Firebase config

### Old Files (Can be removed):
- `src/app/lib/supabaseClient.ts` (if no longer needed)
- `server/src/supabase.js`
- `server/src/supabaseServices.js`
- `server/supabase/schema.sql`

## Running the Application

### Development:

```bash
# Install dependencies
npm install

# Start frontend
npm run dev

# In another terminal, start backend
npm run dev:server
```

### Production:

```bash
# Build frontend
npm run build

# Start backend
npm run start:server
```

## Troubleshooting

### "Firebase is not configured"
- Make sure your `.env.local` has all required Firebase variables
- Check that your API keys are correct in Firebase Console

### "Admin access required"
- Make sure your user's `role` field is set to `'admin'` in Firestore users collection

### Authentication not working
- Verify Google OAuth redirect URIs are configured in Firebase Console
- Check that localhost URLs are added to authorized domains

### Database rules errors
- Check Firestore security rules are correctly set
- Make sure your user UID matches in security rules

## Next Steps

1. Test the application with Firebase
2. Migrate existing data from Supabase to Firebase (if applicable)
3. Set up production Firebase project when ready to deploy
4. Configure backup and disaster recovery in Firebase

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Firebase CLI](https://firebase.google.com/docs/cli)
