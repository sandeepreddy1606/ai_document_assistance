# AI-Assisted Document Authoring and Generation Platform

A full-stack, AI-powered web application that allows authenticated users to generate, refine, and export structured business documents (Word .docx or PowerPoint .pptx) using Google's Gemini API.

## Features

- **User Authentication**: Secure registration and login using Firebase Authentication
- **Project Management**: Create, view, update, and delete document projects
- **Document Types**: Support for Microsoft Word (.docx) and PowerPoint (.pptx) documents
- **AI Content Generation**: Generate content section-by-section or slide-by-slide using Gemini API
- **Interactive Refinement**: Refine generated content with AI-powered prompts
- **User Feedback**: Like/dislike buttons and comments for each section/slide
- **Document Export**: Download final documents in .docx or .pptx format
- **AI-Generated Templates**: Optional feature to generate document outlines or slide structures using AI

## Tech Stack

### Backend
- **FastAPI**: Modern, fast web framework for building APIs
- **Firebase Admin SDK**: User authentication and Firestore database
- **Google Gemini API**: Large Language Model for content generation
- **python-docx**: Word document generation
- **python-pptx**: PowerPoint presentation generation

### Frontend
- **React**: UI library for building user interfaces
- **Material-UI (MUI)**: Component library for modern UI
- **Firebase SDK**: Client-side authentication
- **React Router**: Client-side routing
- **Axios**: HTTP client for API requests

### Database
- **Firestore**: NoSQL database for storing projects, content, and refinement history

## Project Structure

```
ai_document_assistent/
├── backend/
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth_router.py      # Authentication endpoints
│   │   ├── projects_router.py   # Project CRUD operations
│   │   └── documents_router.py  # Document generation, refinement, export
│   ├── main.py                  # FastAPI application entry point
│   ├── requirements.txt         # Python dependencies
│   └── .env.example            # Environment variables template
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── PrivateRoute.js
│   │   ├── contexts/
│   │   │   └── AuthContext.js
│   │   ├── config/
│   │   │   ├── firebase.js
│   │   │   └── api.js
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── Dashboard.js
│   │   │   ├── NewProject.js
│   │   │   └── ProjectDetail.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   └── .env.example
└── README.md
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8+**
- **Node.js 16+** and **npm** (or **yarn**)
- **Firebase Project** with Authentication and Firestore enabled
- **Google Gemini API Key**

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable **Email/Password** provider
4. Enable **Firestore Database**:
   - Go to Firestore Database
   - Create database in production mode (or test mode for development)
   - Set up security rules (see below)
5. Get your Firebase configuration:
   - Go to Project Settings > General
   - Scroll down to "Your apps" section
   - Copy the Firebase configuration object

### 2. Firebase Security Rules

Add these rules to your Firestore database:

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

### 3. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key for use in environment variables

### 4. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - **Windows**:
     ```bash
     venv\Scripts\activate
     ```
   - **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Set up Firebase Admin SDK:
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file as `firebase-credentials.json` in the `backend` directory

6. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

7. Edit `.env` and fill in your values:
   ```env
   FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=8000
   HOST=0.0.0.0
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

### 5. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
 
Optional: install Firebase SDK / CLI

If you want to install the Firebase JavaScript SDK (already included in this project as a dependency) or the Firebase CLI for hosting and other tools, you can run:

```bash
# Install Firebase JS SDK (if needed)
npm install firebase

# Install Firebase CLI (optional, global)
npm install -g firebase-tools
```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and fill in your Firebase configuration:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   REACT_APP_API_URL=http://localhost:8000
   ```

## Running the Application

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Activate your virtual environment (if not already activated)

3. Run the FastAPI server:
   ```bash
   python main.py
   ```
   
   Or using uvicorn directly:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`
   API documentation (Swagger UI) will be available at `http://localhost:8000/docs`

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Start the React development server:
   ```bash
   npm start
   ```

   The application will open in your browser at `http://localhost:3000`

## Usage Guide

### 1. User Registration & Login

- Navigate to the application
- Click "Sign Up" to create a new account
- Enter your name, email, and password
- After registration, you'll be automatically logged in

### 2. Creating a New Project

1. Click "New Project" on the dashboard
2. Enter a project name
3. Select document type (Word Document or PowerPoint)
4. Enter the main topic (e.g., "A market analysis of the EV industry in 2025")
5. **Option A - Manual Configuration**:
   - Add sections/slides manually by entering titles and clicking "Add"
   - Reorder items using up/down arrows
   - Delete items using the delete button
6. **Option B - AI-Generated Template** (Bonus Feature):
   - Click "AI-Suggest Template" button
   - The system will generate a suggested outline/slide structure
   - You can accept, edit, or discard the generated template
7. Click "Create Project"

### 3. Generating Content

1. Open your project from the dashboard
2. Click "Generate Content" button
3. The system will generate content for each section/slide using the Gemini API
4. Content is generated section-by-section with context awareness

### 4. Refining Content

For each section/slide:

1. Review the generated content
2. Enter a refinement prompt in the text box (e.g., "Make this more formal", "Convert to bullet points", "Shorten to 100 words")
3. Click "Refine with AI"
4. The content will be updated based on your prompt

### 5. Providing Feedback

- **Like/Dislike**: Click the thumbs up or thumbs down icons
- **Comments**: Click the comment icon, enter your note, and save
- All feedback is stored in the refinement history

### 6. Exporting Documents

1. Once content is generated and refined, click the "Export" button in the top toolbar
2. The document will be downloaded in the selected format (.docx or .pptx)
3. Open the file in Microsoft Word or PowerPoint

## API Endpoints

### Authentication
- `POST /api/auth/verify` - Verify Firebase token
- `GET /api/auth/user` - Get current user info

### Projects
- `GET /api/projects/` - Get all user projects
- `POST /api/projects/` - Create a new project
- `GET /api/projects/{project_id}` - Get project details
- `PUT /api/projects/{project_id}` - Update project
- `DELETE /api/projects/{project_id}` - Delete project

### Documents
- `POST /api/documents/{project_id}/generate-template` - Generate AI template
- `POST /api/documents/{project_id}/generate-content` - Generate content for all sections/slides
- `POST /api/documents/{project_id}/refine` - Refine a specific section
- `POST /api/documents/{project_id}/feedback` - Add feedback (like/dislike)
- `POST /api/documents/{project_id}/comment` - Add a comment
- `GET /api/documents/{project_id}/export` - Export document as .docx or .pptx

## Environment Variables

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `FIREBASE_CREDENTIALS_PATH` | Path to Firebase service account JSON | `./firebase-credentials.json` |
| `GEMINI_API_KEY` | Google Gemini API key | `your_api_key_here` |
| `PORT` | Backend server port | `8000` |
| `HOST` | Backend server host | `0.0.0.0` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |

### Frontend (.env)

| Variable | Description |
|----------|-------------|
| `REACT_APP_FIREBASE_API_KEY` | Firebase API key |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `REACT_APP_FIREBASE_APP_ID` | Firebase app ID |
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:8000` |

## Troubleshooting

### Backend Issues

1. **Firebase credentials not found**:
   - Ensure `firebase-credentials.json` is in the backend directory
   - Check the path in `.env` file

2. **Gemini API errors**:
   - Verify your API key is correct
   - Check API quota/limits in Google AI Studio

3. **CORS errors**:
   - Ensure frontend URL is in `CORS_ORIGINS` in backend `.env`
   - Check that backend is running on the correct port

### Frontend Issues

1. **Firebase configuration errors**:
   - Verify all Firebase environment variables are set correctly
   - Check Firebase project settings

2. **API connection errors**:
   - Ensure backend is running
   - Check `REACT_APP_API_URL` matches backend URL
   - Verify CORS configuration

3. **Authentication not working**:
   - Check Firebase Authentication is enabled
   - Verify email/password provider is enabled
   - Check browser console for errors

## Development Notes

- The backend uses FastAPI with automatic API documentation at `/docs`
- Frontend uses React with Material-UI for components
- All user data is stored in Firestore with proper security rules
- Content generation uses context from previous sections for coherence
- Document export uses python-docx and python-pptx libraries

## Future Enhancements

- Real-time collaboration
- Version history and rollback
- Multiple language support
- Additional document formats (PDF, Markdown)
- Template library
- Advanced formatting options
- Export customization

## License

This project is created for educational/assignment purposes.

## Support

For issues or questions, please check:
- FastAPI documentation: https://fastapi.tiangolo.com/
- React documentation: https://react.dev/
- Firebase documentation: https://firebase.google.com/docs
- Gemini API documentation: https://ai.google.dev/docs

