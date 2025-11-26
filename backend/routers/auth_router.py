from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
security = HTTPBearer()

class TokenVerification(BaseModel):
    token: str

class UserInfo(BaseModel):
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify Firebase ID token"""
    try:
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}"
        )

@router.post("/verify")
async def verify_user_token(token_data: TokenVerification):
    """Verify a Firebase ID token"""
    try:
        decoded_token = auth.verify_id_token(token_data.token)
        return {
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email"),
            "name": decoded_token.get("name"),
            "verified": True
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )

@router.get("/user")
async def get_current_user(decoded_token: dict = Depends(verify_token)):
    """Get current user information"""
    return {
        "uid": decoded_token["uid"],
        "email": decoded_token.get("email"),
        "name": decoded_token.get("name")
    }

