# Quick Setup Guide

This is a condensed setup guide. For detailed instructions, see [README.md](README.md).

## Prerequisites Checklist

- [ ] Python 3.8+ installed
- [ ] Node.js 16+ and npm installed
- [ ] Firebase project created
- [ ] Gemini API key obtained

## Step-by-Step Setup

### 1. Firebase Setup (5 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create/select a project
3. Enable **Authentication** → Email/Password
4. Enable **Firestore Database** → Create database
5. Go to **Project Settings** → **Service Accounts** → Generate new private key
   - Save as `backend/firebase-credentials.json`
6. Copy Firebase config from **Project Settings** → **General** → **Your apps**

### 2. Backend Setup (3 minutes)

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your values
python main.py
```

**Required .env values:**
- `FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json`
- `GEMINI_API_KEY=your_key_here`
- `PORT=8000`
- `CORS_ORIGINS=http://localhost:3000`

### 3. Frontend Setup (2 minutes)

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with Firebase config from step 1
npm start
```

**Required .env values:**
- All `REACT_APP_FIREBASE_*` variables from Firebase config
- `REACT_APP_API_URL=http://localhost:8000`

### 4. Firestore Security Rules

In Firebase Console → Firestore Database → Rules:

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

## Testing the Setup

1. Backend should be running at `http://localhost:8000`
2. Visit `http://localhost:8000/docs` to see API documentation
3. Frontend should open at `http://localhost:3000`
4. Try registering a new user
5. Create a test project

## Common Issues

**Backend won't start:**
- Check Firebase credentials file exists
- Verify .env file has correct values
- Check Python version (3.8+)

**Frontend can't connect:**
- Ensure backend is running
- Check CORS_ORIGINS in backend .env
- Verify REACT_APP_API_URL in frontend .env

**Authentication errors:**
- Verify Firebase Authentication is enabled
- Check Firebase config in frontend .env
- Ensure email/password provider is enabled

**Content generation fails:**
- Verify GEMINI_API_KEY is set correctly
- Check API quota in Google AI Studio
- Review backend logs for error messages

## Next Steps

Once setup is complete:
1. Register a user account
2. Create a new project
3. Try the AI template generation feature
4. Generate content for your project
5. Refine and export a document

For detailed usage instructions, see the [README.md](README.md).

