from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import UserCreate, UserLogin, UserResponse, TokenResponse, RefreshTokenRequest
from app.core.auth import register_user, authenticate_user, refresh_access_token, logout_user
from app.dependencies.auth import get_current_user
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    return register_user(db, user)

@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    return authenticate_user(db, credentials.username, credentials.password)

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    return refresh_access_token(db, request.refresh_token)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    logout_user(db, request.refresh_token)
    return {"message": "Logged out successfully"}