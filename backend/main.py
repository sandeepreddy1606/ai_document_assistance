from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth, firestore
import firebase_admin
from firebase_admin import credentials
import os
from dotenv import load_dotenv
from typing import List, Optional
from pydantic import BaseModel
import uvicorn

from routers import auth_router, projects_router, documents_router

load_dotenv()

app = FastAPI(title="AI Document Assistant API", version="1.0.0")

# Temporary debug middleware: log OPTIONS request headers to diagnose CORS preflight 400s.
# This is safe and non-destructive; remove after debugging.
from starlette.requests import Request
import traceback


@app.middleware("http")
async def log_options_request_headers(request: Request, call_next):
    try:
        if request.method == "OPTIONS":
            print("== DEBUG OPTIONS REQUEST ==")
            print("path:", request.url.path)
            for k, v in request.headers.items():
                print(f"{k}: {v}")
            print("== END DEBUG ==")
    except Exception:
        print("Failed to log OPTIONS request headers:")
        traceback.print_exc()
    return await call_next(request)

# CORS Configuration
# Read CORS origins from env, trim whitespace and drop empty entries to avoid malformed origin strings
origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
origins = [o.strip() for o in origins_raw.split(",") if o.strip()]
# Allow a regex for localhost origins so the frontend dev server can run on any port
# e.g. http://localhost:3000 or http://localhost:3001 etc. This is safe for local
# development but you should lock this down for production.
allow_origin_regex = os.getenv("CORS_ALLOW_ORIGIN_REGEX", r"^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "./firebase-credentials.json")
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        print("Warning: Firebase credentials not found. Authentication will not work.")

# Security
security = HTTPBearer()

# Include routers
app.include_router(auth_router.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(projects_router.router, prefix="/api/projects", tags=["Projects"])
app.include_router(documents_router.router, prefix="/api/documents", tags=["Documents"])

@app.get("/")
async def root():
    return {"message": "AI Document Assistant API", "status": "running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)

