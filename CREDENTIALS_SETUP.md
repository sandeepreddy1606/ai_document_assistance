# Credentials Setup Guide

To run this project, you need to provide the following credentials:

## 1. Firebase Credentials

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add project" or select an existing project
3. Follow the setup wizard

### Step 2: Enable Authentication
1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. Click "Save"

### Step 3: Enable Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose "Start in test mode" (for development) or "Start in production mode"
4. Select a location for your database
5. Click "Enable"

### Step 4: Get Service Account Key (for Backend)
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Go to **Service Accounts** tab
3. Click "Generate new private key"
4. Click "Generate key" in the dialog
5. Save the downloaded JSON file as `firebase-credentials.json` in the `backend` folder

### Step 5: Get Firebase Config (for Frontend)
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. If you don't have a web app, click the web icon (`</>`) to add one
4. Register your app (you can use any app nickname)
5. Copy the Firebase configuration object - it looks like:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 2. Gemini API Key

### Step 1: Get API Key
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

## 3. Configure Environment Variables

### Backend Configuration
1. In the `backend` folder, create a file named `.env`
2. Copy the contents from `env.example.txt` (if it exists) or use this template:
```env
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
GEMINI_API_KEY=your_gemini_api_key_here
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```
3. Replace `your_gemini_api_key_here` with your actual Gemini API key
4. Make sure `firebase-credentials.json` is in the `backend` folder

### Frontend Configuration
1. In the `frontend` folder, create a file named `.env`
2. Copy the contents from `env.example.txt` (if it exists) or use this template:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key_from_firebase_config
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
REACT_APP_API_URL=http://localhost:8000
```
3. Replace all the values with your actual Firebase config values from Step 5 above

## 4. Firestore Security Rules

In Firebase Console → Firestore Database → Rules, add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }
  }
}
```

Click "Publish" to save the rules.

